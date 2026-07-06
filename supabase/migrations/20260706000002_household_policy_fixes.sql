-- Fix RLS: add WITH CHECK to the household leader profile update policy.
-- The original policy had no WITH CHECK, which meant a crafted direct API
-- call could change family_id, role, or other sensitive columns on a
-- household member's profile. The WITH CHECK ensures the row stays in the
-- current household after the update.

drop policy if exists "Household leaders can update household member profiles" on public.profiles;

create policy "Household leaders can update household member profiles"
  on public.profiles for update
  using (
    auth.uid() != id
    and family_id is not null
    and family_id = public.current_family_id()
    and exists (
      select 1 from public.profiles self
      where self.id = auth.uid()
        and self.relationship in ('primary', 'spouse')
        and self.role in ('member', 'content_editor', 'admin')
    )
  )
  with check (
    -- After update, the row must still belong to the current household.
    -- Prevents moving a member to a different family via this policy.
    family_id = public.current_family_id()
  );
