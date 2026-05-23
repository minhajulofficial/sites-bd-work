-- ============================================================================
-- PR-10: Supabase Storage bucket + policies for the admin banner CMS.
--
-- The banner CMS uploads image files to a dedicated `banners` bucket. Two
-- policies are layered on `storage.objects` to mirror the same admin-write /
-- authenticated-read split used by `public.banners` itself:
--
--   * Any signed-in user may SELECT objects in the bucket — they need to be
--     able to load the image when the dashboard slider renders it.
--   * Only admins (`public.is_admin(auth.uid())`) may INSERT, UPDATE, or
--     DELETE objects.
--
-- The bucket is **not** marked public; the dashboard's `/api/banners` route
-- generates signed URLs at fetch time so unauthenticated browsers cannot
-- guess and pull arbitrary objects out of storage.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bucket — idempotent insert so this migration can be re-run safely.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banners',
  'banners',
  false,
  2 * 1024 * 1024, -- 2 MB, matches the application-level cap.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. RLS policies on storage.objects scoped to the `banners` bucket.
--
-- `storage.objects` already has RLS enabled by default in a Supabase project
-- (Supabase ships with it on). The policies below are additive — they grant
-- the bucket-specific permissions without touching any existing policies.
-- ----------------------------------------------------------------------------

drop policy if exists banners_storage_authenticated_select on storage.objects;
create policy banners_storage_authenticated_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'banners');

drop policy if exists banners_storage_admin_insert on storage.objects;
create policy banners_storage_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'banners' and public.is_admin(auth.uid())
  );

drop policy if exists banners_storage_admin_update on storage.objects;
create policy banners_storage_admin_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'banners' and public.is_admin(auth.uid()))
  with check (bucket_id = 'banners' and public.is_admin(auth.uid()));

drop policy if exists banners_storage_admin_delete on storage.objects;
create policy banners_storage_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'banners' and public.is_admin(auth.uid()));
