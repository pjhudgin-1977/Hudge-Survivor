-- Hudge Survivor Pool
-- Security hardening for views, functions, RPC permissions, and trigger helpers.
-- Created 2026-07-29.

begin;

-- Views should respect the querying user's RLS policies.
alter view public.pool_standings
set (security_invoker = true);

alter view public.v_standings
set (security_invoker = true);

alter view public.v_sweat_game_board
set (security_invoker = true);

alter view public.v_sweat_player_board
set (security_invoker = true);

alter view public.v_sweat_team_exposure
set (security_invoker = true);

alter view public.v_danger_zone
set (security_invoker = true);

alter view public.v_elimination_impact
set (security_invoker = true);

alter view public.v_alive_summary
set (security_invoker = true);

alter view public.v_week_roster
set (security_invoker = true);

alter view public.pool_dashboard
set (security_invoker = true);

alter view public.v_week_pick_board
set (security_invoker = true);

alter view public.v_missing_picks
set (security_invoker = true);

alter view public.v_used_teams
set (security_invoker = true);

alter view public.v_pick_popularity
set (security_invoker = true);

alter view public.v_team_availability_heatmap
set (security_invoker = true);

alter view public.v_week_locks_status
set (security_invoker = true);

alter view public.v_pool_invites_manage
set (security_invoker = true);

alter view public.v_pool_member_latest_pick
set (security_invoker = true);


-- Trigger helper maintains used_teams while direct RPC calls remain blocked.
alter function public.sync_used_teams_from_picks()
security definer;

alter function public.sync_used_teams_from_picks()
set search_path = public;

revoke execute
on function public.sync_used_teams_from_picks()
from public, anon, authenticated;


-- Current commissioner lock function uses pool_members authorization.
create or replace function public.commissioner_set_week_lock_at(
  _pool_id uuid,
  _week_number integer,
  _week_type text,
  _lock_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_pool_commissioner(_pool_id) then
    raise exception 'not authorized';
  end if;

  insert into public.pool_week_locks (
    pool_id,
    week_number,
    week_type,
    lock_at
  )
  values (
    _pool_id,
    _week_number,
    _week_type,
    _lock_at
  )
  on conflict (pool_id, week_number, week_type)
  do update
    set lock_at = excluded.lock_at;
end;
$function$;


-- Users may add only their own additional entries to pools they already joined.
create or replace function public.add_pool_entry(
  p_pool_id uuid,
  p_user_id uuid,
  p_screen_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing_count int;
  v_next_entry_no int;
  v_screen_name text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  if not public.is_pool_member(p_pool_id) then
    raise exception 'not a pool member';
  end if;

  perform 1
  from public.pool_members
  where pool_id = p_pool_id
    and user_id = auth.uid()
  for update;

  select count(*)
    into v_existing_count
  from public.pool_members
  where pool_id = p_pool_id
    and user_id = auth.uid();

  if v_existing_count >= 3 then
    return jsonb_build_object(
      'ok', false,
      'error', 'MAX_ENTRIES_REACHED'
    );
  end if;

  select coalesce(max(entry_no), 0) + 1
    into v_next_entry_no
  from public.pool_members
  where pool_id = p_pool_id
    and user_id = auth.uid();

  select coalesce(
    nullif(trim(p_screen_name), ''),
    nullif(trim(screen_name), ''),
    'Player'
  )
    into v_screen_name
  from public.pool_members
  where pool_id = p_pool_id
    and user_id = auth.uid()
  order by entry_no
  limit 1;

  v_screen_name := coalesce(v_screen_name, 'Player');

  insert into public.pool_members (
    pool_id,
    user_id,
    entry_no,
    screen_name,
    role,
    is_commissioner,
    losses,
    is_eliminated,
    entry_fee_paid
  )
  values (
    p_pool_id,
    auth.uid(),
    v_next_entry_no,
    v_screen_name,
    'member',
    false,
    0,
    false,
    false
  );

  return jsonb_build_object(
    'ok', true,
    'entry_no', v_next_entry_no
  );
end;
$function$;


-- Invite previews require a valid active invite code.
create or replace function public.get_pool_preview_by_code(p_code text)
returns table (
  pool_id uuid,
  pool_name text,
  commissioner_name text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_pool_id uuid;
  v_comm_user uuid;
  v_comm_screen text;
  v_comm_full text;
  v_pool_name text;
begin
  select i.pool_id
    into v_pool_id
  from public.pool_invites i
  where upper(i.code) = upper(trim(p_code))
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.uses < i.max_uses)
  limit 1;

  if v_pool_id is null then
    return;
  end if;

  select coalesce(
    nullif(p.pool_name, ''),
    nullif(p.name, ''),
    'Survivor Pool'
  )
    into v_pool_name
  from public.pools p
  where p.id = v_pool_id
  limit 1;

  select m.user_id, m.screen_name
    into v_comm_user, v_comm_screen
  from public.pool_members m
  where m.pool_id = v_pool_id
    and coalesce(m.is_commissioner, false) = true
  limit 1;

  select pr.full_name
    into v_comm_full
  from public.profiles pr
  where pr.user_id = v_comm_user
  limit 1;

  pool_id := v_pool_id;
  pool_name := v_pool_name;
  commissioner_name := coalesce(
    nullif(v_comm_full, ''),
    nullif(v_comm_screen, ''),
    'Commissioner'
  );

  return next;
end;
$function$;


-- Invite redemption requires authentication.
create or replace function public.redeem_invite_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_pool_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_code is null or btrim(p_code) = '' then
    return null;
  end if;

  update public.pool_invites i
  set uses = coalesce(i.uses, 0) + 1
  where upper(i.code) = upper(btrim(p_code))
    and i.is_active = true
    and (i.expires_at is null or i.expires_at > now())
    and (
      i.max_uses is null
      or coalesce(i.uses, 0) < i.max_uses
    )
  returning i.pool_id into v_pool_id;

  return v_pool_id;
end;
$function$;


-- Server-only and trigger-only functions.
revoke execute on function public.broadcast_pool_message_changes()
from public, anon, authenticated;

revoke execute on function public.handle_new_user_profile()
from public, anon, authenticated;

revoke execute on function public.autolock_picks_for_all_pools()
from public, anon, authenticated;

revoke execute on function public.autolock_picks_for_all_pools_with_stats()
from public, anon, authenticated;

revoke execute on function public.force_autopick_now(uuid)
from public, anon, authenticated;

revoke execute on function public.commissioner_set_week_lock(
  uuid,
  integer,
  boolean
)
from public, anon, authenticated;

revoke execute on function public.resync_pool_member_losses(uuid)
from public, anon, authenticated;


-- Authenticated application RPCs.
revoke execute on function public.add_pool_entry(uuid, uuid, text)
from public, anon;
grant execute on function public.add_pool_entry(uuid, uuid, text)
to authenticated;

revoke execute on function public.commissioner_override_pick(
  uuid,
  uuid,
  integer,
  text,
  text
)
from public, anon;
grant execute on function public.commissioner_override_pick(
  uuid,
  uuid,
  integer,
  text,
  text
)
to authenticated;

revoke execute on function public.commissioner_set_week_lock_at(
  uuid,
  integer,
  text,
  timestamptz
)
from public, anon;
grant execute on function public.commissioner_set_week_lock_at(
  uuid,
  integer,
  text,
  timestamptz
)
to authenticated;

revoke execute on function public.create_pool_invite(uuid)
from public, anon;
grant execute on function public.create_pool_invite(uuid)
to authenticated;

revoke execute on function public.disable_pool_invite(uuid, uuid)
from public, anon;
grant execute on function public.disable_pool_invite(uuid, uuid)
to authenticated;

revoke execute on function public.list_pool_invites_manage(uuid)
from public, anon;
grant execute on function public.list_pool_invites_manage(uuid)
to authenticated;

revoke execute on function public.redeem_invite_code(text)
from public, anon;
grant execute on function public.redeem_invite_code(text)
to authenticated;

revoke execute on function public.is_pool_member(uuid)
from public, anon;
grant execute on function public.is_pool_member(uuid)
to authenticated;

revoke execute on function public.is_pool_commissioner(uuid)
from public, anon;
grant execute on function public.is_pool_commissioner(uuid)
to authenticated;


-- Invite preview intentionally remains available before login.
revoke execute on function public.get_pool_preview_by_code(text)
from public;

grant execute on function public.get_pool_preview_by_code(text)
to anon, authenticated;


-- Fix mutable search paths on all matching overloads.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as function_signature
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'log_used_team_from_pick',
        'make_invite_suffix',
        'prevent_locked_pick_changes',
        'grade_picks_for_week',
        'create_invite_code',
        'autopick_best_team',
        'create_pool_invite',
        'get_invite_by_code',
        'force_autopick_now',
        'eligible_teams',
        'commissioner_set_week_lock',
        'prevent_eliminated_pick_changes',
        'autolock_picks_for_all_pools_with_stats',
        'enforce_pick_lock',
        'apply_losses_for_week',
        'autolock_picks_for_all_pools'
      )
  loop
    execute format(
      'alter function %s set search_path = public',
      fn.function_signature
    );
  end loop;
end
$$;

commit;
