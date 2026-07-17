-- Seed a local admin user for development
-- Email: admin@local.dev / Password: password123
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

-- Dev-only starter group so the prayer wall's restricted-visibility flow is
-- testable locally. Production deployments create their own groups at
-- /admin/groups.
INSERT INTO public.member_groups (name, description, color, icon, display_order, grants_prayer_access, is_serving_role)
VALUES ('Prayer Warriors', 'Sees prayer requests shared with prayer warriors', '#8A6BB5', 'shield', 0, true, true)
ON CONFLICT DO NOTHING;
