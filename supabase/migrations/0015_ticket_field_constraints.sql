-- ============================================================================
-- 0015_ticket_field_constraints.sql
-- Tickets are written via direct browser-to-PostgREST calls (not server
-- actions), unlike clients/ticket-types/developers/sprints which go
-- through zod-validated "use server" actions. The UI's `maxLength`/
-- `min`/`required` attributes are the only guard today — trivially
-- bypassed with a raw REST call, and nothing backs them up at the DB
-- layer. Add CHECK constraints mirroring the bounds already used
-- elsewhere in this project's zod schemas (200 for short text fields,
-- 4000 for long text) as the real backstop.
-- ============================================================================

alter table tickets
  add constraint tickets_title_length check (char_length(title) between 1 and 200),
  add constraint tickets_description_length check (description is null or char_length(description) <= 4000),
  add constraint tickets_ticket_number_positive check (ticket_number > 0);
