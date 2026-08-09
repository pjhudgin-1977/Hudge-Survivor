create table if not exists public.pick_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null,
  user_id uuid not null,
  season_year integer not null,
  week_type text not null,
  week_number integer not null,
  reminder_type text not null default 'sunday_missing_pick',
  recipient_email text not null,
  sent_at timestamptz not null default now()
);

create unique index if not exists pick_reminder_sends_unique_send
on public.pick_reminder_sends (
  pool_id,
  user_id,
  season_year,
  week_type,
  week_number,
  reminder_type
);
