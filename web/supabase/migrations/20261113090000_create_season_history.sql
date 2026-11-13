-- Permanent historical results for Hudge Survivor.
-- Archive records are created only after a season is finalized.

create table public.season_archives (
  pool_id uuid not null,
  season_year integer not null,
  archived_at timestamptz not null default now(),
  archived_by uuid,
  notes text,
  primary key (pool_id, season_year)
);

create table public.season_archive_entries (
  pool_id uuid not null,
  season_year integer not null,
  user_id uuid not null,
  entry_no integer not null,
  screen_name text not null,
  full_name_line text,
  losses integer not null default 0,
  eliminated boolean not null default false,
  finish_place integer,
  winnings_cents integer not null default 0,
  picks jsonb not null default '[]'::jsonb,
  primary key (pool_id, season_year, user_id, entry_no),
  foreign key (pool_id, season_year)
    references public.season_archives (pool_id, season_year),
  constraint valid_winnings check (winnings_cents >= 0),
  constraint valid_finish_place check (
    finish_place is null or finish_place >= 1
  ),
  constraint valid_archive_picks check (
    jsonb_typeof(picks) = 'array'
  )
);

create index season_archive_entries_placement_idx
on public.season_archive_entries (
  pool_id, season_year, finish_place
);

alter table public.season_archives enable row level security;
alter table public.season_archive_entries enable row level security;

create policy "Pool members can view season archives"
on public.season_archives
for select to authenticated
using (public.is_pool_member(pool_id));

create policy "Pool members can view historical standings"
on public.season_archive_entries
for select to authenticated
using (public.is_pool_member(pool_id));
