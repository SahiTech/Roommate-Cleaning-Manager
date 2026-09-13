create schema if not exists private;

create or replace function private.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.room_id = p_room_id
      and m.user_id = (select auth.uid())
      and m.active = true
  );
$$;

create or replace function private.is_room_admin(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.room_id = p_room_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and m.role = 'admin'
  );
$$;

revoke all on function private.is_room_member(uuid) from public, anon;
revoke all on function private.is_room_admin(uuid) from public, anon;
grant execute on function private.is_room_member(uuid), private.is_room_admin(uuid) to authenticated;
