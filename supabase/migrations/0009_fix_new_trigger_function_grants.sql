-- 0008 revoked from PUBLIC, but pg_proc.proacl showed these two functions
-- actually got explicit grants to anon/authenticated directly (this
-- project's default privileges apparently grant new functions to those
-- roles explicitly, not via PUBLIC) — so 0008 was a no-op. Revoke from
-- the roles that actually held the grant this time. Verified afterward:
-- proacl for both is now just {postgres=X/postgres,service_role=X/postgres},
-- matching the already-correctly-restricted handle_new_user /
-- enforce_ticket_approval_permission from migration 0006.
revoke execute on function prevent_last_admin_removal() from anon, authenticated;
revoke execute on function validate_ticket_references() from anon, authenticated;
