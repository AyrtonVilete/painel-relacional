-- ============================================================================
-- 0022_status_is_denied.sql
-- Lets an admin flag one status as the "denied" column (parallel to
-- statuses.is_terminal from 0018). Purely opt-in, same philosophy as the
-- rest of the statuses system: no status is force-created for any org,
-- admins build/flag their own via /settings/statuses. Deliberately left
-- independent from is_terminal — a denied ticket is a distinct outcome
-- from a resolved one, not folded into resolution-time/throughput metrics
-- unless the admin also happens to mark the same status terminal.
-- ============================================================================

alter table statuses
  add column is_denied boolean not null default false;
