-- ============================================================================
-- 0029_status_is_approved.sql
-- Fourth status flag, mirrors is_terminal (0018), is_denied (0022), and
-- is_awaiting_approval (0024). Fixes a real gap: clicking "Aprovar" on a
-- ticket only ever flipped tickets.approved (and optionally set
-- execution_deadline) — it never moved the ticket's status_id, so the card
-- stayed in "Aguardando aprovação" instead of visibly landing in the
-- "Aprovado" column like the denied flow already does via is_denied.
-- Purely opt-in, same philosophy as the rest of the statuses system: no
-- status is force-created for any org, admins flag their own via
-- /settings/statuses (Aprovar just skips the move if none is configured).
-- ============================================================================

alter table statuses
  add column is_approved boolean not null default false;

-- Every existing org's board still has exactly one status literally named
-- "Aprovado" (confirmed via direct query before writing this migration —
-- none have been renamed/duplicated), the same status
-- create_organization_with_admin already seeds for new orgs.
update statuses
set is_approved = true
where name = 'Aprovado';

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

  insert into statuses (board_id, name, "order", is_awaiting_approval, is_approved)
  values
    (new_board_id, 'Aguardando aprovação', 0, true, false),
    (new_board_id, 'Aprovado', 1, false, true),
    (new_board_id, 'Em andamento', 2, false, false),
    (new_board_id, 'Concluído', 3, false, false);

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
