alter table public.notification_config disable row level security;
revoke all on table public.notification_config from anon, authenticated;
alter table public.room_invites disable row level security;
revoke all on table public.room_invites from anon, authenticated;
revoke execute on function public.claim_existing_room(text) from public, anon, authenticated;

create index if not exists cleaning_schedules_member_id_idx on public.cleaning_schedules(member_id);
create index if not exists members_room_id_idx on public.members(room_id);
create index if not exists notification_events_room_id_idx on public.notification_events(room_id);
create index if not exists notification_events_member_created_idx on public.notification_events(member_id, created_at desc);
create index if not exists notification_subscriptions_member_id_idx on public.notification_subscriptions(member_id);
create index if not exists room_invites_room_id_idx on public.room_invites(room_id);
create index if not exists room_invites_created_by_idx on public.room_invites(created_by);
create index if not exists rooms_owner_user_id_idx on public.rooms(owner_user_id);
create index if not exists cleaning_tasks_room_date_due_idx on public.cleaning_tasks(room_id, duty_date, due_at);

drop policy if exists schedules_delete on public.cleaning_schedules;
drop policy if exists schedules_insert on public.cleaning_schedules;
drop policy if exists schedules_select on public.cleaning_schedules;
drop policy if exists schedules_update on public.cleaning_schedules;
create policy schedules_delete on public.cleaning_schedules for delete to authenticated using ((select private.is_room_admin(room_id)));
create policy schedules_insert on public.cleaning_schedules for insert to authenticated with check ((select private.is_room_admin(room_id)));
create policy schedules_select on public.cleaning_schedules for select to authenticated using ((select private.is_room_member(room_id)));
create policy schedules_update on public.cleaning_schedules for update to authenticated using ((select private.is_room_admin(room_id))) with check ((select private.is_room_admin(room_id)));

drop policy if exists tasks_insert on public.cleaning_tasks;
drop policy if exists tasks_select on public.cleaning_tasks;
drop policy if exists tasks_update on public.cleaning_tasks;
create policy tasks_insert on public.cleaning_tasks for insert to authenticated with check ((select private.is_room_admin(room_id)));
create policy tasks_select on public.cleaning_tasks for select to authenticated using ((select private.is_room_member(room_id)));
create policy tasks_update on public.cleaning_tasks for update to authenticated using ((select private.is_room_admin(room_id)) or exists (select 1 from public.members m where m.id=cleaning_tasks.member_id and m.user_id=(select auth.uid()) and m.active=true)) with check ((select private.is_room_member(room_id)));

drop policy if exists members_delete on public.members;
drop policy if exists members_insert on public.members;
drop policy if exists members_select on public.members;
drop policy if exists members_update on public.members;
create policy members_delete on public.members for delete to authenticated using ((select private.is_room_admin(room_id)));
create policy members_insert on public.members for insert to authenticated with check ((select private.is_room_admin(room_id)));
create policy members_select on public.members for select to authenticated using ((select private.is_room_member(room_id)));
create policy members_update on public.members for update to authenticated using ((select private.is_room_admin(room_id))) with check ((select private.is_room_admin(room_id)));

drop policy if exists notification_events_select on public.notification_events;
drop policy if exists notification_events_update on public.notification_events;
create policy notification_events_select on public.notification_events for select to authenticated using (exists (select 1 from public.members m where m.id=notification_events.member_id and m.user_id=(select auth.uid()) and m.active=true));
create policy notification_events_update on public.notification_events for update to authenticated using (exists (select 1 from public.members m where m.id=notification_events.member_id and m.user_id=(select auth.uid()) and m.active=true)) with check (exists (select 1 from public.members m where m.id=notification_events.member_id and m.user_id=(select auth.uid()) and m.active=true));

drop policy if exists notification_subscriptions_delete on public.notification_subscriptions;
drop policy if exists notification_subscriptions_insert on public.notification_subscriptions;
drop policy if exists notification_subscriptions_select on public.notification_subscriptions;
drop policy if exists notification_subscriptions_update on public.notification_subscriptions;
create policy notification_subscriptions_delete on public.notification_subscriptions for delete to authenticated using (exists (select 1 from public.members m where m.id=notification_subscriptions.member_id and m.user_id=(select auth.uid()) and m.active=true));
create policy notification_subscriptions_insert on public.notification_subscriptions for insert to authenticated with check (exists (select 1 from public.members m where m.id=notification_subscriptions.member_id and m.user_id=(select auth.uid()) and m.active=true));
create policy notification_subscriptions_select on public.notification_subscriptions for select to authenticated using (exists (select 1 from public.members m where m.id=notification_subscriptions.member_id and m.user_id=(select auth.uid()) and m.active=true));
create policy notification_subscriptions_update on public.notification_subscriptions for update to authenticated using (exists (select 1 from public.members m where m.id=notification_subscriptions.member_id and m.user_id=(select auth.uid()) and m.active=true)) with check (exists (select 1 from public.members m where m.id=notification_subscriptions.member_id and m.user_id=(select auth.uid()) and m.active=true));

drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy profiles_select on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

drop policy if exists rooms_insert on public.rooms;
drop policy if exists rooms_select on public.rooms;
drop policy if exists rooms_update on public.rooms;
create policy rooms_insert on public.rooms for insert to authenticated with check (owner_user_id=(select auth.uid()));
create policy rooms_select on public.rooms for select to authenticated using ((select private.is_room_member(id)) or owner_user_id=(select auth.uid()));
create policy rooms_update on public.rooms for update to authenticated using ((select private.is_room_admin(id))) with check ((select private.is_room_admin(id)));
