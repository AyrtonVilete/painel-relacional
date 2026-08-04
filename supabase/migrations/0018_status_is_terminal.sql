-- ============================================================================
-- 0018_status_is_terminal.sql
-- Statuses are freeform per-org text today with no concept of "this status
-- means the ticket is done" — needed to compute resolution time / throughput
-- on the dashboard. Admin-configurable per status, defaults to false so
-- existing boards don't suddenly report everything as unresolved-forever
-- but nothing as resolved either (safe default, no behavior change until an
-- admin opts a status in via the new /settings/statuses page).
-- ============================================================================

alter table statuses
  add column is_terminal boolean not null default false;
