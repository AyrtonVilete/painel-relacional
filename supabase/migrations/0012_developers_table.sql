-- ============================================================================
-- 0012_developers_table.sql
-- Developer used to be picked from org membership/profiles (any signed-up
-- user). Replace with a dedicated, admin-managed roster — mirrors
-- clients/ticket_types so devs can be named/curated independently of who
-- has a login, and repurposed developer_id to point at this new table.
-- ============================================================================

create table developers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index developers_organization_id_idx on developers (organization_id);

alter table developers enable row level security;

create policy "org members can view developers"
  on developers for select
  using (is_org_member(organization_id));

create policy "org admins can create developers"
  on developers for insert
  with check (is_org_admin(organization_id));

create policy "org admins can update developers"
  on developers for update
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

create policy "org admins can delete developers"
  on developers for delete
  using (is_org_admin(organization_id));

-- Repoint tickets.developer_id at the new table instead of profiles. No
-- ticket currently has developer_id set (confirmed before writing this
-- migration), so no data backfill is needed.
alter table tickets drop constraint tickets_developer_id_fkey;

alter table tickets
  add constraint tickets_developer_id_fkey
  foreign key (developer_id) references developers (id) on delete set null;

-- Update the cross-reference integrity trigger: developer_id now belongs
-- to developers (which has its own organization_id), same shape as
-- client_id/type_id, instead of the memberships-based check.
create or replace function validate_ticket_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_org_id uuid;
  v_status_board_id uuid;
begin
  select organization_id into v_board_org_id from boards where id = new.board_id;
  if v_board_org_id is null or v_board_org_id <> new.organization_id then
    raise exception 'board_id does not belong to this ticket''s organization';
  end if;

  select board_id into v_status_board_id from statuses where id = new.status_id;
  if v_status_board_id is null or v_status_board_id <> new.board_id then
    raise exception 'status_id does not belong to this ticket''s board';
  end if;

  if new.sprint_id is not null then
    if not exists (select 1 from sprints where id = new.sprint_id and board_id = new.board_id) then
      raise exception 'sprint_id does not belong to this ticket''s board';
    end if;
  end if;

  if new.client_id is not null then
    if not exists (select 1 from clients where id = new.client_id and organization_id = new.organization_id) then
      raise exception 'client_id does not belong to this ticket''s organization';
    end if;
  end if;

  if new.type_id is not null then
    if not exists (select 1 from ticket_types where id = new.type_id and organization_id = new.organization_id) then
      raise exception 'type_id does not belong to this ticket''s organization';
    end if;
  end if;

  if new.developer_id is not null then
    if not exists (select 1 from developers where id = new.developer_id and organization_id = new.organization_id) then
      raise exception 'developer_id does not belong to this ticket''s organization';
    end if;
  end if;

  return new;
end;
$$;
