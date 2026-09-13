create table if not exists public.commissioner_messages (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null,
  user_id uuid not null,
  subject text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.commissioner_messages enable row level security;

drop policy if exists "members can send commissioner messages"
on public.commissioner_messages;

create policy "members can send commissioner messages"
on public.commissioner_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = commissioner_messages.pool_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "commissioners can read commissioner messages"
on public.commissioner_messages;

create policy "commissioners can read commissioner messages"
on public.commissioner_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = commissioner_messages.pool_id
      and pm.user_id = auth.uid()
      and (
        coalesce(pm.is_commissioner, false)
        or lower(coalesce(pm.role, '')) in ('commissioner', 'admin')
      )
  )
);

drop policy if exists "commissioners can update commissioner messages"
on public.commissioner_messages;

create policy "commissioners can update commissioner messages"
on public.commissioner_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = commissioner_messages.pool_id
      and pm.user_id = auth.uid()
      and (
        coalesce(pm.is_commissioner, false)
        or lower(coalesce(pm.role, '')) in ('commissioner', 'admin')
      )
  )
)
with check (
  exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = commissioner_messages.pool_id
      and pm.user_id = auth.uid()
      and (
        coalesce(pm.is_commissioner, false)
        or lower(coalesce(pm.role, '')) in ('commissioner', 'admin')
      )
  )
);

drop policy if exists "commissioners can delete commissioner messages"
on public.commissioner_messages;

create policy "commissioners can delete commissioner messages"
on public.commissioner_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = commissioner_messages.pool_id
      and pm.user_id = auth.uid()
      and (
        coalesce(pm.is_commissioner, false)
        or lower(coalesce(pm.role, '')) in ('commissioner', 'admin')
      )
  )
);
