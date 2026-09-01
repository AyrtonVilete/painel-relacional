-- ============================================================================
-- 0028_fix_org_logo_upload_rls.sql
-- Fixes every logo upload failing with "new row violates row-level security
-- policy" in production. Root cause: 0027 gave org-logos an INSERT policy
-- but no SELECT policy on storage.objects, reasoning that a public bucket's
-- reads bypass RLS entirely — true for the public URL serving path, but NOT
-- for the authenticated upload path. Storage API reads the row back after
-- inserting it (RETURNING-equivalent), and Postgres RLS requires a matching
-- SELECT policy for that read even though the INSERT's WITH CHECK already
-- passed — confirmed by reproducing the exact failure with a raw simulated
-- `insert ... returning` (failed) vs a plain `insert` with no returning
-- (succeeded, but the row was invisible without this policy).
-- ============================================================================

create policy "org members can view logo files"
  on storage.objects for select
  using (bucket_id = 'org-logos' and is_org_member(((storage.foldername(name))[1])::uuid));
