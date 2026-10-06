begin;
-- Treat a missing pick after the weekly lock as a loss.
-- "NO PICK" is a sentinel pick value and must not count as a used NFL team.

-- 1. Allow NO PICK to occur more than once during a season while still
-- preventing reuse of actual NFL teams.
drop index if exists public.picks_no_reuse_team_by_entry_type_idx;

create unique index picks_no_reuse_team_by_entry_type_idx
on public.picks (pool_id, user_id, entry_no, week_type, picked_team)
where picked_team <> 'NO PICK';


-- 2. Do not add NO PICK to used_teams.
create or replace function public.sync_used_teams_from_picks()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  old_phase public.team_phase;
  new_phase public.team_phase;
begin
  if new.picked_team is null
     or btrim(new.picked_team) = ''
     or new.picked_team = 'NO PICK'
  then
    return new;
  end if;

  new_phase := case
    when new.phase::text = 'regular' then 'regular'::public.team_phase
    else 'playoffs'::public.team_phase
  end;

  if tg_op = 'UPDATE' then
    old_phase := case
      when old.phase::text = 'regular' then 'regular'::public.team_phase
      else 'playoffs'::public.team_phase
    end;

    if (
      old.pool_id,
      old.user_id,
      coalesce(old.entry_no, 1),
      old.phase,
      old.picked_team
    ) is distinct from (
      new.pool_id,
      new.user_id,
      coalesce(new.entry_no, 1),
      new.phase,
      new.picked_team
    ) then
      delete from public.used_teams
      where pool_id = old.pool_id
        and user_id = old.user_id
        and entry_no = coalesce(old.entry_no, 1)
        and phase = old_phase
        and team_abbr = old.picked_team;
    end if;
  end if;

  insert into public.used_teams (
    pool_id,
    user_id,
    entry_no,
    team_abbr,
    phase,
    used_at
  )
  values (
    new.pool_id,
    new.user_id,
    coalesce(new.entry_no, 1),
    new.picked_team,
    new_phase,
    now()
  )
  on conflict (pool_id, user_id, entry_no, phase, team_abbr)
  do update set used_at = excluded.used_at;

  return new;
end;
$function$;


-- 3. Permit the system-generated NO PICK loss record to be inserted
-- after the weekly deadline. Normal player inserts remain protected
-- by the existing RLS policies.
create or replace function public.enforce_pick_lock()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_lock_at timestamptz;
  v_week_type text;
begin
  if lower(new.phase::text) = 'playoffs' then
    v_week_type := 'PLAYOFF';
  else
    v_week_type := 'REG';
  end if;

  select lock_at
  into v_lock_at
  from public.pool_week_locks
  where pool_id = new.pool_id
    and week_type = v_week_type
    and week_number = new.week_number
  limit 1;

  if v_lock_at is null or now() < v_lock_at then
    return new;
  end if;

  -- Allow the automated system to record a missed pick as a loss.
  -- RLS prevents authenticated players from creating this sentinel pick.
  if tg_op = 'INSERT'
     and new.picked_team = 'NO PICK'
     and new.result = 'loss'::public.pick_result
     and new.locked = true
     and new.was_autopick = false
  then
    return new;
  end if;

  -- Allow grading/admin result updates after lock.
  if tg_op = 'UPDATE'
     and old.pool_id is not distinct from new.pool_id
     and old.user_id is not distinct from new.user_id
     and old.entry_no is not distinct from new.entry_no
     and old.phase is not distinct from new.phase
     and old.week_number is not distinct from new.week_number
     and old.picked_team is not distinct from new.picked_team
  then
    return new;
  end if;

  raise exception 'Picks are locked for this week (lock_at=%)', v_lock_at;
end;
$function$;


-- 4. At Sunday 1 PM ET, make normal autopicks first.
-- Any surviving entry that STILL has no pick receives a NO PICK loss.
create or replace function public.autolock_picks_for_all_pools()
returns void
language plpgsql
set search_path = public
as $function$
declare
  ps_row record;
  m_row record;
  v_team text;
  v_phase public.season_phase;
  v_team_phase public.team_phase;
begin
  for ps_row in
    select ps.*
    from public.pool_state ps
    where ps.picks_locked = false

      -- Pool-wide lock/autopick does not occur until
      -- Sunday at 1:00 PM America/New_York.
      and exists (
        select 1
        from public.games g
        where g.season_year = ps.season_year
          and g.phase::text =
            case
              when ps.week_type = 'REG' then 'regular'
              else 'playoffs'
            end
          and g.week_number = ps.week_number
          and g.kickoff_at is not null
          and extract(
            isodow from g.kickoff_at at time zone 'America/New_York'
          ) = 7
          and now() >= (
            (
              date_trunc(
                'day',
                g.kickoff_at at time zone 'America/New_York'
              ) + interval '13 hours'
            ) at time zone 'America/New_York'
          )
      )
  loop
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

    -- Give an autopick to eligible entries first.
    for m_row in
      select
        pm.pool_id,
        pm.user_id,
        pm.entry_no,
        pm.autopicks_used
      from public.pool_members pm
      where pm.pool_id = ps_row.pool_id
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
        ps_row.pool_id,
        m_row.user_id,
        m_row.entry_no,
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
          ps_row.pool_id,
          m_row.user_id,
          m_row.entry_no,
          ps_row.week_number,
          v_phase,
          ps_row.week_type,
          v_team,
          now(),
          true,
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
          ps_row.pool_id,
          m_row.user_id,
          m_row.entry_no,
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
        where pool_id = ps_row.pool_id
          and user_id = m_row.user_id
          and entry_no = m_row.entry_no;
      end if;
    end loop;

    -- After autopicks, any active entry still missing a pick
    -- receives an immediate NO PICK loss.
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
      result,
      counted_in_losses,
      was_autopick
    )
    select
      pm.pool_id,
      pm.user_id,
      pm.entry_no,
      ps_row.week_number,
      v_phase,
      ps_row.week_type,
      'NO PICK',
      now(),
      true,
      'loss'::public.pick_result,
      false,
      false
    from public.pool_members pm
    where pm.pool_id = ps_row.pool_id
      and coalesce(pm.is_eliminated, pm.eliminated, false) = false
      and not exists (
        select 1
        from public.picks p
        where p.pool_id = pm.pool_id
          and p.user_id = pm.user_id
          and p.entry_no = pm.entry_no
          and p.week_number = ps_row.week_number
          and p.phase = v_phase
      )
    on conflict (pool_id, user_id, entry_no, week_number, phase)
    do nothing;

    update public.picks p
    set locked = true
    where p.pool_id = ps_row.pool_id
      and p.week_number = ps_row.week_number
      and p.phase = v_phase
      and coalesce(p.locked, false) = false;

    update public.pool_state ps
    set
      picks_locked = true,
      updated_at = now()
    where ps.pool_id = ps_row.pool_id
      and ps.season_year = ps_row.season_year
      and ps.week_type = ps_row.week_type
      and ps.week_number = ps_row.week_number;
  end loop;
end;
$function$;

-- 5. One-time Week 4 backfill for the Hudge Survivor Pool.
-- Week 4 was already locked before this migration existed, so create
-- NO PICK losses for any active Week 4 entry that still has no pick.

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
  result,
  counted_in_losses,
  was_autopick
)
select
  pm.pool_id,
  pm.user_id,
  pm.entry_no,
  4,
  'regular'::public.season_phase,
  'REG',
  'NO PICK',
  now(),
  true,
  'loss'::public.pick_result,
  false,
  false
from public.pool_members pm
join public.pool_state ps
  on ps.pool_id = pm.pool_id
where pm.pool_id = '4931be58-aa45-4c89-aa36-2f0aa1061f45'::uuid
  and ps.season_year = 2026
  and ps.week_number = 4
  and ps.week_type = 'REG'
  and ps.picks_locked = true
  and coalesce(pm.is_eliminated, pm.eliminated, false) = false
  and not exists (
    select 1
    from public.picks p
    where p.pool_id = pm.pool_id
      and p.user_id = pm.user_id
      and p.entry_no = pm.entry_no
      and p.week_number = 4
      and p.phase = 'regular'::public.season_phase
  )
on conflict (pool_id, user_id, entry_no, week_number, phase)
do nothing;

-- Immediately count the NO PICK loss using the normal loss machinery.
select *
from public.apply_losses_for_week(
  '4931be58-aa45-4c89-aa36-2f0aa1061f45'::uuid,
  2026,
  'regular'::public.season_phase,
  4
);

commit;