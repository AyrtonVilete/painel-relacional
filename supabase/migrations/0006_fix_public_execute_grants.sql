-- ============================================================================
-- 0006_fix_public_execute_grants.sql
-- 0005's per-role REVOKEs had no effect: Postgres grants EXECUTE to PUBLIC by
-- default on function creation, and a role's access via PUBLIC isn't removed
-- by revoking from that role directly. Must revoke from PUBLIC itself.
-- ============================================================================

revoke execute on function handle_new_user() from public;
revoke execute on function enforce_ticket_approval_permission() from public;
revoke execute on function set_updated_at() from public;

revoke execute on function create_organization_with_admin(text, text) from public;
grant execute on function create_organization_with_admin(text, text) to authenticated;
