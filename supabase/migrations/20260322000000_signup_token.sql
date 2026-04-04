-- Add signup token to access_requests for secure self-registration links
alter table public.access_requests
  add column signup_token text unique,
  add column token_expires_at timestamptz;

-- Update handle_new_user to auto-set role to 'member' for approved access requests
create or replace function public.handle_new_user()
returns trigger as $$
declare
  _role text := 'pending';
begin
  -- If there's an approved access request for this email, make them a member
  if exists (
    select 1 from public.access_requests
    where email = new.email
      and status = 'approved'
  ) then
    _role := 'member';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', _role);

  return new;
end;
$$ language plpgsql security definer;
