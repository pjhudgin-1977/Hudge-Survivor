-- Store ESPN game quarter and clock for live Sweat ratings.
-- Existing scoring and grading fields remain unchanged.

alter table public.games
  add column if not exists game_period integer,
  add column if not exists game_clock text,
  add column if not exists clock_seconds integer;
