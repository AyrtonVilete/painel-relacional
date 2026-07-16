-- ============================================================================
-- 0005_harden_function_privileges.sql
-- Addresses Supabase security advisor findings:
--   - set_updated_at had a mutable search_path
--   - trigger-only functions were reachable directly as PostgREST RPC calls
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger-only functions: not meant to be called directly via PostgREST RPC
revoke execute on function handle_new_user() from anon, authenticated;
revoke execute on function enforce_ticket_approval_permission() from anon, authenticated;
revoke execute on function set_updated_at() from anon, authenticated;

-- Signup bootstrap RPC: only signed-in users should ever call this
revoke execute on function create_organization_with_admin(text, text) from anon;
