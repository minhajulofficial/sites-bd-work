-- ============================================================================
-- PR-02: SITES.BD seed data
--
-- Applied AFTER `0001_init.sql`. Idempotent — every insert uses
-- `ON CONFLICT … DO NOTHING` so re-running the seed is safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tlds — runtime mirror of src/config/domains.json
-- ----------------------------------------------------------------------------
insert into public.tlds (
  slug, name, env_prefix, cloudflare_zone_id,
  enabled, is_primary, display_order, label
) values
  (
    'sites-bd', 'sites.bd', 'CF_SITES_BD',
    'replace-with-real-cf-zone-id-sites-bd',
    true, true, 1, 'sites.bd'
  ),
  (
    'esite-top', 'esite.top', 'CF_ESITE_TOP',
    'replace-with-real-cf-zone-id-esite-top',
    true, false, 2, 'esite.top'
  ),
  (
    'esite-in', 'esite.in', 'CF_ESITE_IN',
    'replace-with-real-cf-zone-id-esite-in',
    true, false, 3, 'esite.in'
  )
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Admin user
--
-- Hardcoded UUID for testability. Inserts a minimal `auth.users` row plus
-- the matching `public.profiles` row.
--
-- IMPORTANT: the placeholder password below is a bcrypt hash of
-- `change-me-after-seed`. After running this seed, set the real password
-- via Supabase Dashboard → Authentication → Users → admin@sites.bd →
-- "Send password reset", or via `supabase auth admin update-user`.
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_super_admin,
  is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@sites.bd',
  crypt('change-me-after-seed', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
)
on conflict (id) do nothing;

insert into public.profiles (
  id, customer_id, full_name, email, mobile, address, status, is_admin
) values (
  '00000000-0000-0000-0000-000000000001',
  'SB-ADM01',
  'Sites BD Admin',
  'admin@sites.bd',
  '+8801700000000',
  'Owner office, Dhaka',
  'profile_verified',
  true
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Sample banners — three placeholder slides for the dashboard slider.
--    Created by the seeded admin profile.
-- ----------------------------------------------------------------------------
insert into public.banners (
  image_url, link_url, display_order, active, created_by
) values
  (
    'https://placehold.co/1200x300/2563eb/ffffff?text=Welcome+to+SITES.BD',
    '/services',
    1, true,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'https://placehold.co/1200x300/0ea5e9/ffffff?text=Free+subdomains+on+sites.bd',
    '/check',
    2, true,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'https://placehold.co/1200x300/22c55e/ffffff?text=Now+also+on+esite.top+%26+esite.in',
    '/check',
    3, true,
    '00000000-0000-0000-0000-000000000001'
  )
on conflict do nothing;
