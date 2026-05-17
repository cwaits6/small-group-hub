-- Add invite_token to access_requests so family invite context can be
-- preserved through the access-request → approve → account-creation flow.
-- When a user arrives via /join/family/[token] and submits an access request,
-- the family invite token is stored here. On admin approval the server uses
-- this token to link profiles.family_id and family_members.claimed_profile_id.

alter table public.access_requests
  add column invite_token uuid references public.family_invites(token) on delete set null;

create index access_requests_invite_token_idx on public.access_requests(invite_token);
