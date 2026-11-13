-- Atomically archive a completed Hudge Survivor season.
-- Must be called through an authenticated Supabase user session.

create or replace function public.archive_pool_season(
  p_pool_id uuid,
  p_season_year integer,
  p_payouts jsonb,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_state public.pool_state%rowtype;
  v_phase text;
  v_entries integer;
  v_paid integer;
  v_remaining integer;
  v_games integer;
  v_unfinished integer;
  v_pending integer;
  v_payout_count integer;
  v_distinct_count integer;
  v_invalid integer;
  v_missing boolean;
  v_collected bigint;
  v_hosting bigint;
  v_prize bigint;
  v_payout_total numeric;
  v_inserted integer;
begin
  -- Require the actual signed-in commissioner.
  if v_user_id is null or not exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = p_pool_id
      and pm.user_id = v_user_id
      and pm.is_commissioner = true
  ) then
    raise exception 'Commissioner authorization required';
  end if;

  if p_confirmation is distinct from
     ('ARCHIVE ' || p_season_year::text) then
    raise exception 'Explicit archive confirmation required';
  end if;

  -- Lock the season state for the duration of this transaction.
  select *
  into v_state
  from public.pool_state
  where pool_id = p_pool_id
  for update;

  if not found or v_state.season_year <> p_season_year then
    raise exception 'Season does not match current pool state';
  end if;

  if exists (
    select 1 from public.season_archives
    where pool_id = p_pool_id
      and season_year = p_season_year
  ) then
    raise exception 'This season is already archived';
  end if;

  v_phase := upper(coalesce(v_state.week_type, ''));

  if v_phase not in ('REG', 'PLAYOFF') then
    raise exception 'Unrecognized season phase';
  end if;

  if v_state.picks_locked is distinct from true then
    raise exception 'Current week picks are not locked';
  end if;

  -- Count entries and determine whether the pool has ended.
  select
    count(*)::integer,
    count(*) filter (where entry_fee_paid is true)::integer,
    count(*) filter (
      where coalesce(is_eliminated, false) = false
        and coalesce(eliminated, false) = false
        and coalesce(losses, 0) < 2
    )::integer
  into v_entries, v_paid, v_remaining
  from public.pool_members
  where pool_id = p_pool_id;

  if v_entries = 0 then
    raise exception 'No entries found';
  end if;

  if v_remaining > 1 and not (
    v_phase = 'PLAYOFF' and v_state.week_number = 4
  ) then
    raise exception 'Survivor Pool has not ended';
  end if;

  -- Only games through the pool's final week matter.
  select
    count(*)::integer,
    count(*) filter (
      where lower(coalesce(status, '')) <> 'final'
    )::integer
  into v_games, v_unfinished
  from public.games
  where season_year = p_season_year
    and (
      (v_phase = 'REG'
        and phase::text = 'regular'
        and week_number <= v_state.week_number)
      or
      (v_phase = 'PLAYOFF'
        and (
          phase::text = 'regular'
          or (
            phase::text = 'playoffs'
            and week_number <= v_state.week_number
          )
        ))
    );

  if v_games = 0 or v_unfinished > 0 then
    raise exception 'Relevant NFL games are not all final';
  end if;

  -- Include all recorded picks, not just the first 1,000.
  select count(*)::integer
  into v_pending
  from public.picks
  where pool_id = p_pool_id
    and (
      result is null
      or result::text not in ('win', 'loss')
    );

  if v_pending > 0 then
    raise exception 'Player picks are not all graded';
  end if;

  -- Require valid recorded payments for every paid entry.
  if exists (
    select 1
    from public.pool_members
    where pool_id = p_pool_id
      and entry_fee_paid is true
      and (
        entry_fee_amount is null
        or entry_fee_amount <= 0
      )
  ) then
    raise exception 'Paid entries have missing or invalid amounts';
  end if;

  select coalesce(
    sum(entry_fee_amount * 100)
      filter (where entry_fee_paid is true), 0
  )::bigint
  into v_collected
  from public.pool_members
  where pool_id = p_pool_id;

  v_hosting := v_paid::bigint * 100;
  v_prize := v_collected - v_hosting;

  if v_prize <= 0 then
    raise exception 'Prize pool must be positive';
  end if;

  -- Validate the entire submitted payout list.
  if p_payouts is null
     or jsonb_typeof(p_payouts) <> 'array' then
    raise exception 'Invalid payout list';
  end if;

  select
    count(*)::integer,
    count(distinct (user_id, entry_no))::integer,
    count(*) filter (
      where user_id is null
        or entry_no is null
        or entry_no < 1
        or finish_place is null
        or finish_place < 1
        or finish_place > v_entries
        or winnings_cents is null
        or winnings_cents < 0
    )::integer,
    coalesce(sum(winnings_cents), 0)
  into
    v_payout_count,
    v_distinct_count,
    v_invalid,
    v_payout_total
  from jsonb_to_recordset(p_payouts) as x(
    user_id uuid,
    entry_no integer,
    finish_place integer,
    winnings_cents bigint
  );

  if v_payout_count <> v_entries
     or v_distinct_count <> v_entries
     or v_invalid > 0 then
    raise exception 'Payout entries are missing, duplicated, or invalid';
  end if;

  select exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = p_pool_id
      and not exists (
        select 1
        from jsonb_to_recordset(p_payouts) as x(
          user_id uuid,
          entry_no integer,
          finish_place integer,
          winnings_cents bigint
        )
        where x.user_id = pm.user_id
          and x.entry_no = pm.entry_no
      )
  )
  into v_missing;

  if v_missing then
    raise exception 'Payout list does not match pool entries';
  end if;

  if v_payout_total <> v_prize then
    raise exception 'Winnings must match the prize pool exactly';
  end if;

  -- Parent record and all entries are inserted in one transaction.
  insert into public.season_archives (
    pool_id, season_year, archived_by,
    total_entries, paid_entries,
    collected_cents, hosting_cents, prize_pool_cents
  )
  values (
    p_pool_id, p_season_year, v_user_id,
    v_entries, v_paid,
    v_collected, v_hosting, v_prize
  );

  insert into public.season_archive_entries (
    pool_id, season_year, user_id, entry_no,
    screen_name, full_name_line,
    losses, eliminated,
    finish_place, winnings_cents, picks
  )
  select
    p_pool_id,
    p_season_year,
    pm.user_id,
    pm.entry_no,
    coalesce(nullif(pm.screen_name, ''), 'Unknown'),
    pr.full_name,
    coalesce(pm.losses, 0),
    (
      coalesce(pm.eliminated, false)
      or coalesce(pm.is_eliminated, false)
      or coalesce(pm.losses, 0) >= 2
    ),
    x.finish_place,
    x.winnings_cents,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'week_number', p.week_number,
          'phase', p.phase,
          'picked_team', p.picked_team,
          'was_autopick', p.was_autopick,
          'result', p.result,
          'counted_in_losses', p.counted_in_losses
        )
        order by
          case when p.phase::text = 'regular' then 0 else 1 end,
          p.week_number
      )
      from public.picks p
      where p.pool_id = pm.pool_id
        and p.user_id = pm.user_id
        and p.entry_no = pm.entry_no
    ), '[]'::jsonb)
  from public.pool_members pm
  join jsonb_to_recordset(p_payouts) as x(
    user_id uuid,
    entry_no integer,
    finish_place integer,
    winnings_cents bigint
  )
    on x.user_id = pm.user_id
   and x.entry_no = pm.entry_no
  left join public.profiles pr
    on pr.user_id = pm.user_id
  where pm.pool_id = p_pool_id;

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_entries then
    raise exception 'Incomplete archive; transaction cancelled';
  end if;

  return jsonb_build_object(
    'ok', true,
    'seasonYear', p_season_year,
    'entriesArchived', v_inserted,
    'prizePoolCents', v_prize
  );
end;
$function$;

revoke all on function public.archive_pool_season(
  uuid, integer, jsonb, text
) from public;

grant execute on function public.archive_pool_season(
  uuid, integer, jsonb, text
) to authenticated;
