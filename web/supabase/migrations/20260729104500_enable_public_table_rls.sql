-- Hudge Survivor Pool
-- Security hardening: enable RLS on all public tables that were previously exposed.
-- Created 2026-07-29.
--
-- This migration assumes the existing Hudge database schema, helper functions,
-- tables, constraints, and pool_members policies are already present.

begin;

-- Public NFL reference data: readable, but not directly writable.
alter table public.nfl_teams enable row level security;

drop policy if exists "Anyone can view NFL teams"
on public.nfl_teams;

create policy "Anyone can view NFL teams"
on public.nfl_teams
for select
to anon, authenticated
using (true);


alter table public.nfl_weeks enable row level security;

drop policy if exists "Anyone can view NFL weeks"
on public.nfl_weeks;

create policy "Anyone can view NFL weeks"
on public.nfl_weeks
for select
to anon, authenticated
using (true);


alter table public.games enable row level security;

drop policy if exists "Anyone can view games"
on public.games;

create policy "Anyone can view games"
on public.games
for select
to anon, authenticated
using (true);


alter table public.game_odds enable row level security;

drop policy if exists "Anyone can view game odds"
on public.game_odds;

create policy "Anyone can view game odds"
on public.game_odds
for select
to anon, authenticated
using (true);


alter table public.pool_weeks enable row level security;

drop policy if exists "Anyone can view pool weeks"
on public.pool_weeks;

create policy "Anyone can view pool weeks"
on public.pool_weeks
for select
to anon, authenticated
using (true);


-- Audit records remain server-only.
alter table public.audit_log enable row level security;


-- Signed-in users may read lock timing and pool state.
alter table public.pool_week_locks enable row level security;

drop policy if exists "Authenticated users can view pool week locks"
on public.pool_week_locks;

create policy "Authenticated users can view pool week locks"
on public.pool_week_locks
for select
to authenticated
using (true);


alter table public.pool_state enable row level security;

drop policy if exists "Authenticated users can view pool state"
on public.pool_state;

create policy "Authenticated users can view pool state"
on public.pool_state
for select
to authenticated
using (true);


-- Preserve the current invite/join workflow.
alter table public.pools enable row level security;

drop policy if exists "Authenticated users can view pools"
on public.pools;

create policy "Authenticated users can view pools"
on public.pools
for select
to authenticated
using (true);


-- Pool members may view picks in their pool.
-- Users may create or change only picks belonging to their own valid entries.
alter table public.picks enable row level security;

drop policy if exists "Pool members can view picks"
on public.picks;

create policy "Pool members can view picks"
on public.picks
for select
to authenticated
using (
  public.is_pool_member(pool_id)
);


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
);


drop policy if exists "Users can update their own picks"
on public.picks;

create policy "Users can update their own picks"
on public.picks
for update
to authenticated
using (
  user_id = auth.uid()
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
);


-- used_teams is maintained by a protected database trigger.
alter table public.used_teams enable row level security;

drop policy if exists "Pool members can view used teams"
on public.used_teams;

create policy "Pool members can view used teams"
on public.used_teams
for select
to authenticated
using (
  public.is_pool_member(pool_id)
);

commit;
