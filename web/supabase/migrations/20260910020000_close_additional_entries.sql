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

  -- Hudge Survivor 2026: no new/additional entries after
  -- Sunday, September 13, 2026 at 1:00 PM Eastern (17:00 UTC).
  if p_pool_id = '4931be58-aa45-4c89-aa36-2f0aa1061f45'::uuid
     and now() >= timestamptz '2026-09-13 17:00:00+00' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Pool registration is closed.'
    );
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
