create or replace function public.force_autopick_now(p_pool_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ps_row record;
  m record;
  v_phase public.season_phase;
  v_team_phase public.team_phase;
  v_team text;
  v_inserted int := 0;
  v_skipped_maxed_out int := 0;
begin
  -- Use this pool's current week
  select
    ps.season_year,
    ps.week_type,
    ps.week_number
  into ps_row
  from public.pool_state ps
  where ps.pool_id = p_pool_id
  limit 1;

  if ps_row.week_number is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'no current pool week found'
    );
  end if;

  v_phase :=
    (
      case
        when ps_row.week_type = 'REG' then 'regular'
        else 'playoffs'
      end
    )::public.season_phase;

  v_team_phase :=
    (
      case
        when ps_row.week_type = 'REG' then 'regular'
        else 'playoffs'
      end
    )::public.team_phase;

  -- Count ENTRIES that need a pick but have already used 3 autopicks
  select count(*)
  into v_skipped_maxed_out
  from public.pool_members pm
  where pm.pool_id = p_pool_id
    and coalesce(pm.is_eliminated, pm.eliminated, false) = false
    and coalesce(pm.autopicks_used, 0) >= 3
    and not exists (
      select 1
      from public.picks p
      where p.pool_id = pm.pool_id
        and p.user_id = pm.user_id
        and p.entry_no = pm.entry_no
        and p.week_number = ps_row.week_number
        and p.phase = v_phase
    );

  -- Force an autopick separately for every eligible ENTRY
  for m in
    select
      pm.user_id,
      pm.entry_no
    from public.pool_members pm
    where pm.pool_id = p_pool_id
      and coalesce(pm.is_eliminated, pm.eliminated, false) = false
      and coalesce(pm.autopicks_used, 0) < 3
      and not exists (
        select 1
        from public.picks p
        where p.pool_id = pm.pool_id
          and p.user_id = pm.user_id
          and p.entry_no = pm.entry_no
          and p.week_number = ps_row.week_number
          and p.phase = v_phase
      )
  loop
    v_team := public.autopick_best_team(
      p_pool_id,
      m.user_id,
      m.entry_no,
      ps_row.season_year,
      v_phase::text,
      ps_row.week_number
    );

    if v_team is not null then
      insert into public.picks (
        pool_id,
        user_id,
        entry_no,
        week_number,
        phase,
        week_type,
        picked_team,
        submitted_at,
        locked,
        was_autopick
      )
      values (
        p_pool_id,
        m.user_id,
        m.entry_no,
        ps_row.week_number,
        v_phase,
        ps_row.week_type,
        v_team,
        now(),
        false,
        true
      );

      insert into public.used_teams (
        pool_id,
        user_id,
        entry_no,
        team_abbr,
        phase,
        used_at
      )
      values (
        p_pool_id,
        m.user_id,
        m.entry_no,
        v_team,
        v_team_phase,
        now()
      )
      on conflict (
        pool_id,
        user_id,
        entry_no,
        team_abbr,
        phase
      )
      do nothing;

      update public.pool_members
      set autopicks_used = coalesce(autopicks_used, 0) + 1
      where pool_id = p_pool_id
        and user_id = m.user_id
        and entry_no = m.entry_no;

      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'pool_id', p_pool_id,
    'season_year', ps_row.season_year,
    'week_type', ps_row.week_type,
    'week_number', ps_row.week_number,
    'phase', v_phase,
    'autopicks_inserted', v_inserted,
    'skipped_max_autopicks', v_skipped_maxed_out
  );
end;
$function$;