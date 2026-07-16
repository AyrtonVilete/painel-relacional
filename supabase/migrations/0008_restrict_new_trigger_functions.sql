-- Same treatment as 0005/0006: these are trigger-only functions, not
-- meant to be called directly via PostgREST RPC. Must revoke from PUBLIC
-- specifically — revoking from anon/authenticated alone has no effect
-- when the default grant (on function creation) is to PUBLIC.
--
-- NOTE: this turned out to be a no-op for these two functions — see
-- 0009. Kept for an honest migration history rather than folded away.
revoke execute on function prevent_last_admin_removal() from public;
revoke execute on function validate_ticket_references() from public;
