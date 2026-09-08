create or replace function public.autopick_best_team(
  p_pool_id uuid,
  p_user_id uuid,
  p_entry_no integer,
  p_season_year integer,
  p_phase text,
  p_week_number integer
)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select g.favorite_team
  from public.games g
  where g.season_year = p_season_year
    and g.week_number = p_week_number
    and g.phase::text = p_phase
    and g.favorite_team is not null
    and g.point_spread is not null

    -- Only games that are still eligible at the Sunday 1 PM ET deadline.
    -- This includes Sunday 1 PM games and all later games,
    -- but excludes Thursday/Saturday/Sunday-morning games.
    and g.kickoff_at >= (
      select
        (
          date_trunc(
            'day',
            g2.kickoff_at at time zone 'America/New_York'
          ) + interval '13 hours'
        ) at time zone 'America/New_York'
      from public.games g2
      where g2.season_year = p_season_year
        and g2.week_number = p_week_number
        and g2.phase::text = p_phase
        and extract(
          isodow from g2.kickoff_at at time zone 'America/New_York'
        ) = 7
      order by g2.kickoff_at
      limit 1
    )

    and not exists (
      select 1
      from public.used_teams ut
      where ut.pool_id = p_pool_id
        and ut.user_id = p_user_id
        and ut.entry_no = p_entry_no
        and ut.phase::text = p_phase
        and ut.team_abbr = g.favorite_team
    )
  order by g.point_spread asc, g.kickoff_at asc
  limit 1;
$function$;


create or replace function public.autolock_picks_for_all_pools()
returns void
language plpgsql
set search_path to 'public'
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