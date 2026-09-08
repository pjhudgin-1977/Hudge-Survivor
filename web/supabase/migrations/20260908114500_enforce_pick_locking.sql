drop policy if exists "Users can insert their own picks"
on public.picks;

create policy "Users can insert their own picks"
on public.picks
for insert
to authenticated
with check (
  user_id = auth.uid()

  and exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = picks.pool_id
      and pm.user_id = auth.uid()
      and pm.entry_no = picks.entry_no
  )

  and exists (
    select 1
    from public.pool_state ps
    where ps.pool_id = picks.pool_id
      and ps.picks_locked = false
  )

  and exists (
    select 1
    from public.games g
    join public.pool_state ps
      on ps.pool_id = picks.pool_id
    where g.season_year = ps.season_year
      and g.week_number = picks.week_number
      and lower(g.phase::text) = lower(picks.phase::text)
      and (
        g.home_team = picks.picked_team
        or g.away_team = picks.picked_team
      )
      and g.kickoff_at > now()
  )
);


drop policy if exists "Users can update their own picks"
on public.picks;

create policy "Users can update their own picks"
on public.picks
for update
to authenticated
using (
  user_id = auth.uid()

  and exists (
    select 1
    from public.pool_state ps
    where ps.pool_id = picks.pool_id
      and ps.picks_locked = false
  )

  and exists (
    select 1
    from public.games g
    join public.pool_state ps
      on ps.pool_id = picks.pool_id
    where g.season_year = ps.season_year
      and g.week_number = picks.week_number
      and lower(g.phase::text) = lower(picks.phase::text)
      and (
        g.home_team = picks.picked_team
        or g.away_team = picks.picked_team
      )
      and g.kickoff_at > now()
  )
)
with check (
  user_id = auth.uid()

  and exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = picks.pool_id
      and pm.user_id = auth.uid()
      and pm.entry_no = picks.entry_no
  )

  and exists (
    select 1
    from public.pool_state ps
    where ps.pool_id = picks.pool_id
      and ps.picks_locked = false
  )

  and exists (
    select 1
    from public.games g
    join public.pool_state ps
      on ps.pool_id = picks.pool_id
    where g.season_year = ps.season_year
      and g.week_number = picks.week_number
      and lower(g.phase::text) = lower(picks.phase::text)
      and (
        g.home_team = picks.picked_team
        or g.away_team = picks.picked_team
      )
      and g.kickoff_at > now()
  )
);
