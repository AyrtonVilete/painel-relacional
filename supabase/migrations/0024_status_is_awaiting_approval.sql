-- ============================================================================
-- 0024_status_is_awaiting_approval.sql
-- Third status flag, mirrors is_terminal (0018) and is_denied (0022).
-- Fixes a real mismatch: the ticket card decided Prazo vs. Execução
-- prevista based on tickets.approved (only flips via the dedicated
-- "Aprovar" button), but a ticket dragged straight to the "Aprovado"
-- column — a normal, unrestricted action — never touches that flag, so
-- the card kept showing the pre-approval Prazo date. Basing the badge on
-- which column the ticket is actually sitting in fixes that regardless
-- of whether "Aprovar" was ever clicked.
-- ============================================================================

alter table statuses
  add column is_awaiting_approval boolean not null default false;

-- Every existing org's board still has exactly one status literally named
-- "Aguardando aprovação" (confirmed via direct query before writing this
-- migration — none have been renamed/duplicated), the same starting
-- status create_organization_with_admin already seeds for new orgs.
update statuses
set is_awaiting_approval = true
where name = 'Aguardando aprovação';

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

  insert into statuses (board_id, name, "order", is_awaiting_approval)
  values
    (new_board_id, 'Aguardando aprovação', 0, true),
    (new_board_id, 'Aprovado', 1, false),
    (new_board_id, 'Em andamento', 2, false),
    (new_board_id, 'Concluído', 3, false);

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
