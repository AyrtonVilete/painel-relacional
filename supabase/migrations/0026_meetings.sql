-- ============================================================================
-- 0026_meetings.sql
-- Agenda MVP: reuniões cadastradas manualmente pelo time, por organização
-- (não por board — não fazem parte do quadro kanban). date/time puros em vez
-- de timestamptz para evitar timezone bugs (servidor Vercel roda em UTC,
-- time é no Brasil) — mesmo raciocínio que já levou tickets.deadline/
-- execution_deadline a serem `date` puro.
-- ============================================================================

create table meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  description text,
  meeting_date date not null,
  start_time time not null,
  end_time time,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint meetings_end_after_start check (end_time is null or end_time > start_time)
);

create index meetings_organization_id_idx on meetings (organization_id);
create index meetings_meeting_date_idx on meetings (meeting_date);

alter table meetings enable row level security;

-- Agenda de equipe compartilhada: qualquer membro pode ver e criar.
create policy "org members can view meetings"
  on meetings for select
  using (is_org_member(organization_id));

create policy "org members can create meetings"
  on meetings for insert
  with check (is_org_member(organization_id) and created_by = (select auth.uid()));

-- Editar/excluir restrito a quem criou ou a um admin, para não deixar
-- qualquer membro mexer na reunião de outra pessoa.
create policy "creator or admin can update meetings"
  on meetings for update
  using (
    is_org_member(organization_id)
    and (created_by = (select auth.uid()) or is_org_admin(organization_id))
  )
  with check (
    is_org_member(organization_id)
    and (created_by = (select auth.uid()) or is_org_admin(organization_id))
  );

create policy "creator or admin can delete meetings"
  on meetings for delete
  using (
    is_org_member(organization_id)
    and (created_by = (select auth.uid()) or is_org_admin(organization_id))
  );
