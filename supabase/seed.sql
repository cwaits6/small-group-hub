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
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@local.dev',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Local Admin"}'
);

-- The handle_new_user trigger auto-creates the profile with role 'pending',
-- so we just update it to admin
UPDATE public.profiles SET role = 'admin' WHERE id = 'a0000000-0000-0000-0000-000000000001';
