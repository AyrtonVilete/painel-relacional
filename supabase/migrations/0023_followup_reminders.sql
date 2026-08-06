-- ============================================================================
-- 0023_followup_reminders.sql
-- Replaces the automatic urgency-based SLA deadline (0021_sla_policies)
-- with what the real process actually is:
--   - tickets.deadline (already existed) = target date for the approval
--     meeting, set at ticket creation.
--   - tickets.execution_deadline (new) = target date for doing the work,
--     set once the ticket is approved.
--   - the per-urgency "sla_policies" table is repurposed into a recurring
--     "cobrança de andamento" (progress check-in) reminder interval —
--     not a one-shot deadline. tickets.next_followup_due recomputes from
--     tickets.last_followup_at (or created_at if never followed up) each
--     time urgency or last_followup_at changes, same trigger-computed
--     pattern as the old sla_due_at, just recurring instead of one-shot.
-- ============================================================================

alter table sla_policies rename to followup_policies;
alter table followup_policies rename column duration_hours to interval_hours;

alter policy "org members can view sla policies"
  on followup_policies rename to "org members can view followup policies";
alter policy "org admins can create sla policies"
  on followup_policies rename to "org admins can create followup policies";
alter policy "org admins can update sla policies"
  on followup_policies rename to "org admins can update followup policies";
alter policy "org admins can delete sla policies"
  on followup_policies rename to "org admins can delete followup policies";

-- Existing rows were all still at the original SLA-duration seed defaults
-- (feature shipped same day, confirmed via direct query before writing
-- this migration) — safe to bulk-replace with sensible check-in cadences
-- instead of leaving stale "SLA hours" values that no longer mean
-- anything as a recurring interval.
update followup_policies set interval_hours = case urgency
  when 'critical' then 72   -- a cada 3 dias
  when 'high' then 336      -- a cada 14 dias
  when 'medium' then 504    -- a cada 21 dias
  when 'low' then 720       -- a cada 30 dias
end;

-- ----------------------------------------------------------------------------
-- Drop the old one-shot SLA deadline machinery.
-- ----------------------------------------------------------------------------

drop trigger if exists tickets_set_sla_due_at on tickets;
drop function if exists set_sla_due_at();
alter table tickets drop column if exists sla_due_at;

-- ----------------------------------------------------------------------------
-- New ticket columns.
-- ----------------------------------------------------------------------------

alter table tickets
  add column execution_deadline date,
  add column last_followup_at timestamptz,
  add column next_followup_due timestamptz;

-- Recurring, not one-shot: anchors on last_followup_at when set (reset by
-- the "Marquei a cobrança" action), falling back to created_at for a
-- ticket that's never been followed up on yet. Fires on urgency change
-- (re-triaging should re-anchor the cadence, same reasoning as the old
-- SLA trigger) and on last_followup_at change (the actual reset).
create or replace function set_next_followup_due()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  hours integer;
  anchor timestamptz;
begin
  select interval_hours into hours
  from followup_policies
  where organization_id = new.organization_id
    and urgency = new.urgency;

  anchor := coalesce(new.last_followup_at, new.created_at);

  new.next_followup_due := case
    when hours is null then null
    else anchor + (hours || ' hours')::interval
  end;

  return new;
end;
$$;

drop trigger if exists tickets_set_next_followup_due on tickets;
create trigger tickets_set_next_followup_due
  before insert or update of urgency, last_followup_at on tickets
  for each row execute function set_next_followup_due();

-- Same trigger-only lockdown as every other function of this shape in
-- this project — verify via pg_proc.proacl after applying, don't trust
-- either revoke alone (this project's default grant target has varied).
revoke execute on function set_next_followup_due() from public;
revoke execute on function set_next_followup_due() from anon, authenticated;

-- ----------------------------------------------------------------------------
-- create_organization_with_admin: seed followup_policies (renamed target
-- + new default cadences) instead of the old sla_policies durations.
-- ----------------------------------------------------------------------------

create or replace function create_organization_with_admin(
  org_name text,
  org_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  new_board_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into organizations (name, slug)
  values (org_name, org_slug)
  returning id into new_org_id;

  insert into memberships (organization_id, user_id, role)
  values (new_org_id, auth.uid(), 'admin');

  insert into boards (organization_id, name)
  values (new_org_id, 'Board principal')
  returning id into new_board_id;

  insert into statuses (board_id, name, "order")
  values
    (new_board_id, 'Aguardando aprovação', 0),
    (new_board_id, 'Aprovado', 1),
    (new_board_id, 'Em andamento', 2),
    (new_board_id, 'Concluído', 3);

  insert into ticket_types (organization_id, name)
  values
    (new_org_id, 'Problema'),
    (new_org_id, 'Sugestão');

  insert into followup_policies (organization_id, urgency, interval_hours)
  values
    (new_org_id, 'critical', 72),
    (new_org_id, 'high', 336),
    (new_org_id, 'medium', 504),
    (new_org_id, 'low', 720);

  return new_org_id;
end;
$$;

-- Backfill existing tickets now that followup_policies has real values.
-- Plain UPDATE of next_followup_due only — doesn't touch urgency or
-- last_followup_at, so the trigger above (scoped to those columns)
-- doesn't fire here, which is fine since this computes the same value
-- it would have (anchor = created_at, since last_followup_at is null
-- for every pre-existing ticket).
update tickets t
set next_followup_due = t.created_at + (fp.interval_hours || ' hours')::interval
from followup_policies fp
where fp.organization_id = t.organization_id
  and fp.urgency = t.urgency;
