-- ============================================================================
-- 0030_pdvnet_tickets.sql
-- Mirrors a filtered slice of Nexus's Azure DevOps (PDVNET) work items —
-- only the ones tagged as customer-facing (Relacionamento/Suporte/Urgente/
-- Diretoria/Chamado Antigo/Gestao), not the full dev+QA backlog — into a
-- read-optimized table so the /dashboard/pdvnet page doesn't hit the Azure
-- DevOps API on every page load. Populated by a scheduled sync
-- (src/app/api/cron/pdvnet-sync/route.ts) using the service-role client,
-- never written to directly by end users — no insert/update/delete RLS
-- policy is needed for that reason, same as ticket_history.
-- Scoped to organization_id like every other org-owned table, even though
-- only Nexus's org currently has rows — this is Nexus's own product
-- backlog data, not something other tenants should ever see.
-- ============================================================================

create table pdvnet_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  ado_id integer not null,
  work_item_type text not null,
  state text not null,
  title text not null,
  tags text[] not null default '{}',
  cliente text,
  chamado bigint,
  sistema text,
  dev_owner text,
  qa_owner text,
  assigned_to text,
  priority smallint,
  created_date timestamptz,
  changed_date timestamptz,
  closed_date timestamptz,
  approved_date timestamptz,
  committed_date timestamptz,
  qa_date timestamptz,
  synced_at timestamptz not null default now(),
  unique (organization_id, ado_id)
);

create index pdvnet_tickets_org_idx on pdvnet_tickets(organization_id);
create index pdvnet_tickets_tags_idx on pdvnet_tickets using gin(tags);
create index pdvnet_tickets_state_idx on pdvnet_tickets(state);

alter table pdvnet_tickets enable row level security;

create policy "org members can view pdvnet tickets"
  on pdvnet_tickets for select
  using (is_org_member(organization_id));
