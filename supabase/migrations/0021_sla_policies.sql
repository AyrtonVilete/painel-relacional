-- ============================================================================
-- 0021_sla_policies.sql
-- SLA per urgency: admin-configurable response-time targets, one row per
-- ticket_urgency value per organization. Distinct from tickets.deadline
-- (a manual, optional, client-facing due date) — sla_due_at is an
-- automatic internal target computed from urgency + created_at, never
-- edited directly by a user.
-- ============================================================================

create table sla_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  urgency ticket_urgency not null,
  duration_hours integer not null check (duration_hours > 0),
  unique (organization_id, urgency)
);

alter table sla_policies enable row level security;

-- select is org-member-wide (not admin-only) — the SLA badge needs to
-- render on the board for every member, not just admins.
create policy "org members can view sla policies"
  on sla_policies for select
  using (is_org_member(organization_id));

create policy "org admins can create sla policies"
  on sla_policies for insert
  with check (is_org_admin(organization_id));

create policy "org admins can update sla policies"
  on sla_policies for update
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

create policy "org admins can delete sla policies"
  on sla_policies for delete
  using (is_org_admin(organization_id));

-- ----------------------------------------------------------------------------
-- create_organization_with_admin: seed default SLA policies for new orgs,
-- same starting point as the default statuses/ticket_types already seeded
-- here. Admin can adjust afterward via /settings/sla.
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

  insert into sla_policies (organization_id, urgency, duration_hours)
  values
    (new_org_id, 'critical', 4),
    (new_org_id, 'high', 24),
    (new_org_id, 'medium', 72),
    (new_org_id, 'low', 120);

  return new_org_id;
end;
$$;

-- Seed the same defaults for orgs that already existed before this
-- migration (their sla_policies table starts empty otherwise).
insert into sla_policies (organization_id, urgency, duration_hours)
select o.id, u.urgency, u.duration_hours
from organizations o
cross join (
  values
    ('critical'::ticket_urgency, 4),
    ('high'::ticket_urgency, 24),
    ('medium'::ticket_urgency, 72),
    ('low'::ticket_urgency, 120)
) as u(urgency, duration_hours)
on conflict (organization_id, urgency) do nothing;

-- ----------------------------------------------------------------------------
-- tickets.sla_due_at: computed target timestamp, kept in sync by trigger.
-- ----------------------------------------------------------------------------

alter table tickets add column sla_due_at timestamptz;

-- Always computed from the ticket's original created_at, never from the
-- moment urgency was changed — an old ticket that gets re-triaged to a
-- higher urgency shouldn't have its clock reset to "now + duration", it
-- should reflect what the deadline would have been had it started at that
-- urgency. If no matching policy exists (shouldn't happen once the seed
-- above runs, but defensive), sla_due_at is left null rather than erroring.
create or replace function set_sla_due_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  hours integer;
begin
  select duration_hours into hours
  from sla_policies
  where organization_id = new.organization_id
    and urgency = new.urgency;

  new.sla_due_at := case
    when hours is null then null
    else new.created_at + (hours || ' hours')::interval
  end;

  return new;
end;
$$;

drop trigger if exists tickets_set_sla_due_at on tickets;
create trigger tickets_set_sla_due_at
  before insert or update of urgency on tickets
  for each row execute function set_sla_due_at();

-- Same class of function as validate_ticket_references/
-- prevent_last_admin_removal (0008/0009) — trigger-only, never meant to be
-- called directly as a PostgREST RPC. Revoke from every path a fresh
-- function might have picked up a default grant from in this project
-- (it has varied between PUBLIC and anon/authenticated directly across
-- past migrations) — verify the real result via pg_proc.proacl after
-- applying rather than trusting either revoke alone worked.
revoke execute on function set_sla_due_at() from public;
revoke execute on function set_sla_due_at() from anon, authenticated;

-- Backfill existing tickets now that sla_policies rows exist for every
-- org. Plain UPDATE of sla_due_at only — doesn't touch urgency, so the
-- trigger above (scoped to "update of urgency") doesn't fire here, which
-- is fine since this computes the same value it would have.
update tickets t
set sla_due_at = t.created_at + (sp.duration_hours || ' hours')::interval
from sla_policies sp
where sp.organization_id = t.organization_id
  and sp.urgency = t.urgency;
