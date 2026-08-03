-- ============================================================================
-- 0011_ticket_number_manual_entry.sql
-- ticket_number was auto-generated (identity), but tickets here track a
-- number from an external ticketing system that the user already manages
-- elsewhere — they need to type that system's own ticket number in, not
-- get a fresh sequential one assigned. Drop the identity/auto-generation
-- so the app must always supply it explicitly. Stays integer, NOT NULL,
-- and unique (unchanged).
-- ============================================================================

alter table tickets alter column ticket_number drop identity if exists;
