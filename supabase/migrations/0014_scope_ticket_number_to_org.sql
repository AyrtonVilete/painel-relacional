-- ============================================================================
-- 0014_scope_ticket_number_to_org.sql
-- ticket_number mirrors a number each org's own external ticketing system
-- assigns independently, so a global UNIQUE(ticket_number) means two
-- unrelated orgs collide the moment they both happen to use the same
-- number. Scope the uniqueness to (organization_id, ticket_number).
-- ============================================================================

alter table tickets drop constraint tickets_ticket_number_key;

alter table tickets
  add constraint tickets_org_ticket_number_key unique (organization_id, ticket_number);
