-- Retire the prayer-access capability (maintainer decision, 2026-08-01).
--
-- The prayer wall's restricted tier (visible_to_warriors requests readable
-- only by members of a grants_prayer_access group) is being removed: the
-- target model is a request that is either visible to all members or posted
-- anonymously — no per-group read access. This migration drops the whole
-- access mechanism:
--
--   member_groups.grants_prayer_access  (capability flag)
--   profiles.is_prayer_warrior          (denormalized per-profile flag)
--   sync_prayer_access_for_profile/group() + their triggers (kept the flag
--                                        in sync with group membership)
--   is_prayer_warrior()                 (RLS helper reading the flag)
--
-- prayer_requests.visible_to_warriors STAYS for now. Existing restricted
-- requests were shared with a specific audience; silently widening them to
-- every member would be a privacy break. With the warrior arm removed from
-- the SELECT policy below they collapse to author-only (+ admin via the
-- update/delete paths) — fail-closed. The composer no longer offers the
-- option, so no new restricted rows are created. Deciding the fate of the
-- legacy rows and dropping the column is the follow-up issue
-- (prayer wall: anonymous-or-all model).

-- Rewrite the read policy first — it is the only consumer of
-- is_prayer_warrior(). Same shape as 20260731000007 minus the warrior arm.
drop policy "Members can view visible prayer requests" on public.prayer_requests;
create policy "Members can view visible prayer requests" on public.prayer_requests
  for select to authenticated
  using (
    org_id = (select public.app_request_org_id())
    and (select public.is_member())
    and (
      author_id = (select auth.uid())
      or not visible_to_warriors
    )
  );

drop trigger profile_groups_sync_prayer_access on public.profile_groups;
drop trigger member_groups_sync_prayer_access on public.member_groups;
drop function public.sync_prayer_access_for_profile();
drop function public.sync_prayer_access_for_group();
drop function public.is_prayer_warrior();

alter table public.profiles drop column is_prayer_warrior;
alter table public.member_groups drop column grants_prayer_access;
