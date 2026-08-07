alter table public.games
add column if not exists score_updated_at timestamptz;
