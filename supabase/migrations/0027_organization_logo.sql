-- ============================================================================
-- 0027_organization_logo.sql
-- Lets an org admin customize the logo shown in the app header, either by
-- pasting an external image URL or uploading a file. Public bucket (unlike
-- ticket-attachments' private one) — a company logo isn't sensitive, and a
-- public URL means the header never needs a signed-URL refresh cycle to
-- keep displaying it. Write access is still admin-gated via storage RLS.
-- ============================================================================

alter table organizations add column logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-logos',
  'org-logos',
  true,
  2097152, -- 2MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- No select policy needed: Supabase serves public-bucket objects through an
-- unauthenticated public URL that bypasses storage.objects RLS entirely.
create policy "org admins can upload logo files"
  on storage.objects for insert
  with check (bucket_id = 'org-logos' and is_org_admin(((storage.foldername(name))[1])::uuid));

create policy "org admins can update logo files"
  on storage.objects for update
  using (bucket_id = 'org-logos' and is_org_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'org-logos' and is_org_admin(((storage.foldername(name))[1])::uuid));

create policy "org admins can delete logo files"
  on storage.objects for delete
  using (bucket_id = 'org-logos' and is_org_admin(((storage.foldername(name))[1])::uuid));
