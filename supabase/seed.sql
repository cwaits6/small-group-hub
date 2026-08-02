-- Seed a local admin user for development
-- Email: admin@local.dev / Password: password123

-- Phase 2 (CWA-9): handle_new_user() is fail-closed — a signup with no
-- approved access request or family invite raises. Seed the approval first
-- so the trigger resolves the admin into the default org.
INSERT INTO public.access_requests (org_id, name, email, status, reviewed_at)
SELECT '00000000-0000-0000-0000-000000000001', 'Local Admin', 'admin@local.dev', 'approved', now()
WHERE NOT EXISTS (
  -- Scoped to the default org and case-insensitive (GoTrue lowercases auth
  -- emails). An approved request for this email in ANOTHER org must not
  -- suppress the seed row — the trigger would then resolve the admin into
  -- that org; with both rows present it fails loudly (TN002) instead.
  SELECT 1 FROM public.access_requests
  WHERE org_id = '00000000-0000-0000-0000-000000000001'
    AND lower(email) = lower('admin@local.dev')
    AND status = 'approved'
);

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  email_change_confirm_status,
  phone,
  phone_change,
  phone_change_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@local.dev',
  crypt('password123', gen_salt('bf', 10)),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  '',
  '',
  0,
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Local Admin"}'
)
ON CONFLICT (id) DO NOTHING;

-- The handle_new_user trigger auto-creates the profile with role 'pending',
-- so we just update it to admin
UPDATE public.profiles SET role = 'admin' WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Dev-only starter group so the serving flow is testable locally.
-- Deployments create their own groups at /admin/groups — provisioning
-- seeds none.
INSERT INTO public.member_groups (id, org_id, name, description, color, icon, display_order, is_serving_role)
VALUES ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Serving Team', 'Signs up to serve on Sundays', '#7C9885', 'hands', 0, true)
-- Refresh the mutable fixture fields on re-seed so a stale local row picks
-- up seed changes; id and org_id are preserved, and a same-id row that
-- somehow belongs to another org is left untouched.
ON CONFLICT (id) DO UPDATE
  SET name = excluded.name,
      description = excluded.description,
      color = excluded.color,
      icon = excluded.icon,
      display_order = excluded.display_order,
      is_serving_role = excluded.is_serving_role
  WHERE member_groups.org_id = excluded.org_id;
