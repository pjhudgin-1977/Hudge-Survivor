create or replace function public.join_pool_with_invite(
  p_code text,
  p_expected_pool_id uuid,
  p_full_name text,
  p_screen_name text
)
returns table(
  pool_id uuid,
  entry_no integer,
  screen_name text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_pool_id uuid;
  v_entry_no integer;
  v_final_screen_name text;
  v_full_name text;
  v_screen_name text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  v_full_name := btrim(coalesce(p_full_name, ''));
  v_screen_name := btrim(coalesce(p_screen_name, ''));

  if length(v_full_name) < 2 then
    raise exception 'Full name must be at least 2 characters.';
  end if;

  if length(v_full_name) > 100 then
    raise exception 'Full name must be 100 characters or fewer.';
  end if;

  if length(v_screen_name) < 2 then
    raise exception 'Screen name must be at least 2 characters.';
  end if;

  if length(v_screen_name) > 30 then
    raise exception 'Screen name must be 30 characters or fewer.';
  end if;

  select i.pool_id
  into v_pool_id
  from public.pool_invites i
  where upper(i.code) = upper(btrim(coalesce(p_code, '')))
    and i.is_active = true
    and (i.expires_at is null or i.expires_at > now())
    and (
      i.max_uses is null
      or coalesce(i.uses, 0) < i.max_uses
    )
  for update;

  if v_pool_id is null then
    raise exception 'Invalid or expired invite code.';
  end if;

  if v_pool_id <> p_expected_pool_id then
    raise exception 'Invite code does not match this pool.';
  end if;

  select candidate
  into v_entry_no
  from generate_series(1, 3) as candidate
  where not exists (
    select 1
    from public.pool_members m
    where m.pool_id = v_pool_id
      and m.user_id = v_user_id
      and m.entry_no = candidate
  )
  order by candidate
  limit 1;

  if v_entry_no is null then
    raise exception
      'You already have the maximum of 3 entries in this pool.';
  end if;

  insert into public.profiles (
    user_id,
    email,
    full_name,
    referred_by
  )
  select
    v_user_id,
    u.email,
    v_full_name,
    null
  from auth.users u
  where u.id = v_user_id
  on conflict (user_id)
  do update set
    email = excluded.email,
    full_name =
      case
        when nullif(btrim(public.profiles.full_name), '') is null
          then excluded.full_name
        when lower(btrim(public.profiles.full_name)) =
             lower(split_part(excluded.email, '@', 1))
          then excluded.full_name
        else public.profiles.full_name
      end,
    updated_at = now();

  v_final_screen_name :=
    case
      when v_entry_no = 1 then v_screen_name
      else v_screen_name || ' (Entry ' || v_entry_no || ')'
    end;

  insert into public.pool_members (
    pool_id,
    user_id,
    entry_no,
    screen_name,
    role,
    is_commissioner,
    losses,
    is_eliminated
  )
  values (
    v_pool_id,
    v_user_id,
    v_entry_no,
    v_final_screen_name,
    'member',
    false,
    0,
    false
  );

  update public.pool_invites i
  set uses = coalesce(i.uses, 0) + 1
  where upper(i.code) = upper(btrim(p_code))
    and i.pool_id = v_pool_id;

  pool_id := v_pool_id;
  entry_no := v_entry_no;
  screen_name := v_final_screen_name;

  return next;
end;
$function$;
