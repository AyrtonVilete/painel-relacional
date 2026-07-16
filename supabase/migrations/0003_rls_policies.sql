-- ============================================================================
-- 0003_rls_policies.sql
-- Row Level Security: every organization-scoped table is locked down so a
-- user can only ever see/touch rows belonging to organizations they are a
-- member of. Helper functions centralize the membership/role checks.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- helper functions (security definer so they can read `memberships`
-- regardless of the caller's own RLS visibility into that table)
-- ----------------------------------------------------------------------------

create or replace function is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

create or replace function is_org_admin(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organization_id = org_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_org_admin_or_approver(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organization_id = org_id and user_id = auth.uid()
      and role in ('admin', 'approver')
  );
$$;

-- board -> organization helper (statuses/sprints hang off boards, not org directly)
create or replace function board_org_id(p_board_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from boards where id = p_board_id;
$$;

-- ticket -> organization helper (ticket_history hangs off tickets)
create or replace function ticket_org_id(p_ticket_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from tickets where id = p_ticket_id;
$$;

-- ----------------------------------------------------------------------------
-- enable RLS everywhere
-- ----------------------------------------------------------------------------

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;
alter table clients enable row level security;
alter table boards enable row level security;
alter table statuses enable row level security;
alter table ticket_types enable row level security;
alter table sprints enable row level security;
alter table tickets enable row level security;
alter table ticket_history enable row level security;
alter table layout_preferences enable row level security;

-- ----------------------------------------------------------------------------
-- organizations
-- (row creation goes through create_organization_with_admin, which is
-- security definer, so no insert policy is needed/granted here)
-- ----------------------------------------------------------------------------

create policy "org members can view their organization"
  on organizations for select
  using (is_org_member(id));

create policy "org admins can update their organization"
  on organizations for update
  using (is_org_admin(id))
  with check (is_org_admin(id));

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------

create policy "users can view own profile"
  on profiles for select
  using (id = auth.uid());

create policy "users can view profiles of org-mates"
  on profiles for select
  using (
    exists (
      select 1 from memberships m1
      join memberships m2 on m1.organization_id = m2.organization_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

create policy "users can update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- memberships
-- ----------------------------------------------------------------------------

create policy "org members can view memberships in their org"
  on memberships for select
  using (is_org_member(organization_id));

create policy "org admins can manage memberships"
  on memberships for insert
  with check (is_org_admin(organization_id));

create policy "org admins can update memberships"
  on memberships for update
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

create policy "org admins can remove memberships"
  on memberships for delete
  using (is_org_admin(organization_id));

-- ----------------------------------------------------------------------------
-- clients
-- ----------------------------------------------------------------------------

create policy "org members can view clients"
  on clients for select
  using (is_org_member(organization_id));

create policy "org members can create clients"
  on clients for insert
  with check (is_org_member(organization_id));

create policy "org members can update clients"
  on clients for update
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy "org admins can delete clients"
  on clients for delete
  using (is_org_admin(organization_id));

-- ----------------------------------------------------------------------------
-- boards
-- ----------------------------------------------------------------------------

create policy "org members can view boards"
  on boards for select
  using (is_org_member(organization_id));

create policy "org admins can create boards"
  on boards for insert
  with check (is_org_admin(organization_id));

create policy "org admins can update boards"
  on boards for update
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

create policy "org admins can delete boards"
  on boards for delete
  using (is_org_admin(organization_id));

-- ----------------------------------------------------------------------------
-- statuses
-- ----------------------------------------------------------------------------

create policy "org members can view statuses"
  on statuses for select
  using (is_org_member(board_org_id(board_id)));

create policy "org admins can create statuses"
  on statuses for insert
  with check (is_org_admin(board_org_id(board_id)));

create policy "org admins can update statuses"
  on statuses for update
  using (is_org_admin(board_org_id(board_id)))
  with check (is_org_admin(board_org_id(board_id)));

create policy "org admins can delete statuses"
  on statuses for delete
  using (is_org_admin(board_org_id(board_id)));

-- ----------------------------------------------------------------------------
-- ticket_types
-- ----------------------------------------------------------------------------

create policy "org members can view ticket types"
  on ticket_types for select
  using (is_org_member(organization_id));

create policy "org admins can create ticket types"
  on ticket_types for insert
  with check (is_org_admin(organization_id));

create policy "org admins can update ticket types"
  on ticket_types for update
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

create policy "org admins can delete ticket types"
  on ticket_types for delete
  using (is_org_admin(organization_id));

-- ----------------------------------------------------------------------------
-- sprints
-- ----------------------------------------------------------------------------

create policy "org members can view sprints"
  on sprints for select
  using (is_org_member(board_org_id(board_id)));

create policy "org admins can create sprints"
  on sprints for insert
  with check (is_org_admin(board_org_id(board_id)));

create policy "org admins can update sprints"
  on sprints for update
  using (is_org_admin(board_org_id(board_id)))
  with check (is_org_admin(board_org_id(board_id)));

create policy "org admins can delete sprints"
  on sprints for delete
  using (is_org_admin(board_org_id(board_id)));

-- ----------------------------------------------------------------------------
-- tickets
-- ----------------------------------------------------------------------------

create policy "org members can view tickets"
  on tickets for select
  using (is_org_member(organization_id));

create policy "org members can create tickets"
  on tickets for insert
  with check (is_org_member(organization_id));

create policy "org members can update tickets"
  on tickets for update
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy "org admins can delete tickets"
  on tickets for delete
  using (is_org_admin(organization_id));

-- Only admins/approvers may flip a ticket's `approved` flag. Everyone else
-- can still update the rest of the row (move it, edit title, etc).
create or replace function enforce_ticket_approval_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved is distinct from old.approved
     and not is_org_admin_or_approver(old.organization_id) then
    raise exception 'Only admins or approvers can change ticket approval status';
  end if;
  return new;
end;
$$;

create trigger tickets_enforce_approval_permission
  before update on tickets
  for each row execute function enforce_ticket_approval_permission();

-- ----------------------------------------------------------------------------
-- ticket_history (append-only: select + insert only, no update/delete policy)
-- ----------------------------------------------------------------------------

create policy "org members can view ticket history"
  on ticket_history for select
  using (is_org_member(ticket_org_id(ticket_id)));

create policy "org members can append ticket history"
  on ticket_history for insert
  with check (is_org_member(ticket_org_id(ticket_id)));

-- ----------------------------------------------------------------------------
-- layout_preferences (strictly personal)
-- ----------------------------------------------------------------------------

create policy "users can view own layout preferences"
  on layout_preferences for select
  using (user_id = auth.uid());

create policy "users can create own layout preferences"
  on layout_preferences for insert
  with check (user_id = auth.uid());

create policy "users can update own layout preferences"
  on layout_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete own layout preferences"
  on layout_preferences for delete
  using (user_id = auth.uid());
