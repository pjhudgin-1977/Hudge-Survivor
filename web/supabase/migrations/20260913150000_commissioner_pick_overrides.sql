create table if not exists public.commissioner_pick_overrides (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null,
  commissioner_user_id uuid not null,
  target_user_id uuid not null,
  entry_no integer not null,
  season_year integer,
  week_number integer not null,
  phase text not null,
  week_type text,
  old_team text,
  new_team text not null,
  reason text not null,
  replaced_autopick boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.commissioner_pick_overrides enable row level security;

create index if not exists commissioner_pick_overrides_pool_created_idx
  on public.commissioner_pick_overrides (pool_id, created_at desc);

create index if not exists commissioner_pick_overrides_target_idx
  on public.commissioner_pick_overrides
    (pool_id, target_user_id, entry_no, week_number);
