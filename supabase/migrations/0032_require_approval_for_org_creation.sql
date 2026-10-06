-- ============================================================================
-- 0032_require_approval_for_org_creation.sql
-- Database-level backstop for the access-approval gate.
--
-- The app blocks unapproved accounts in its middleware, but anyone holding
-- a valid login can still call Supabase's REST API directly, bypassing the
-- app entirely — including the create_organization_with_admin RPC. This
-- trigger refuses to create an organization unless the caller's JWT carries
-- app_metadata.access_approved = true (a flag only the service-role key can
-- set, via /plataforma, an org-admin invite, or the one-off backfill).
--
-- A trigger on organizations rather than a redefinition of the RPC: the
-- migration history has drifted from the live database before (0021), so
-- replacing the function body from this repo's copy could break it. Calls
-- with no user (service role, SQL editor) are unaffected: auth.uid() is null.
--
-- NOT applied automatically: run it in the Supabase SQL editor.
-- ============================================================================

create or replace function enforce_org_creation_requires_approval()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null
     and coalesce((auth.jwt() -> 'app_metadata' ->> 'access_approved')::boolean, false) is not true then
    raise exception 'Access has not been approved for this account';
  end if;
  return new;
end;
$$;

-- Trigger-only, same as the other trigger functions here (0008/0009).
revoke execute on function enforce_org_creation_requires_approval() from public;
revoke execute on function enforce_org_creation_requires_approval() from anon, authenticated;

drop trigger if exists organizations_require_approval on organizations;
create trigger organizations_require_approval
  before insert on organizations
  for each row execute function enforce_org_creation_requires_approval();
