-- Preserve final financial totals with each archived season.

alter table public.season_archives
  add column total_entries integer not null default 0,
  add column paid_entries integer not null default 0,
  add column collected_cents bigint not null default 0,
  add column hosting_cents bigint not null default 0,
  add column prize_pool_cents bigint not null default 0;

alter table public.season_archives
  add constraint valid_archive_financial_totals check (
    total_entries >= 0
    and paid_entries >= 0
    and paid_entries <= total_entries
    and collected_cents >= 0
    and hosting_cents = paid_entries * 100
    and prize_pool_cents = collected_cents - hosting_cents
    and prize_pool_cents >= 0
  );
