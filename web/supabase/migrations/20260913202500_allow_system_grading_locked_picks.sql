create or replace function public.prevent_locked_pick_changes()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.locked = true
     and new.picked_team is distinct from old.picked_team
     and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'This pick is locked and can no longer be changed';
  end if;

  if old.locked = true
     and new.locked = false
     and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'This pick is locked and can no longer be changed';
  end if;

  return new;
end;
$function$;
