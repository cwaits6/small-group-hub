-- ============================================================
-- Sync login email changes to profiles.email
-- ============================================================
-- Members can now change their own login email from the Settings page
-- (supabase.auth.updateUser). Once the change is confirmed, auth.users
-- is updated — mirror it onto the profile so the directory and admin
-- views show the current address.

create or replace function public.handle_auth_user_email_change()
returns trigger as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute procedure public.handle_auth_user_email_change();
