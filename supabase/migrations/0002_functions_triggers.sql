-- ============================================================================
-- 0002_functions_triggers.sql
-- Signup bootstrap, invite bootstrap, and the ticket-move RPC that guarantees
-- ticket_history is always written (never overwritten, always appended).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles auto-creation + invite-membership auto-creation on new auth user
--
-- Invite flow: an admin invites a user via Supabase Admin API
-- (auth.admin.inviteUserByEmail) passing user_metadata:
--   { organization_id: '<uuid>', role: 'member' | 'approver' | 'admin' }
-- When that user completes signup, this trigger creates their membership.
-- ----------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_org_id uuid;
  invited_role membership_role;
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  invited_org_id := (new.raw_user_meta_data ->> 'organization_id')::uuid;

  if invited_org_id is not null then
    invited_role := coalesce(
      (new.raw_user_meta_data ->> 'role')::membership_role,
      'member'
    );

    insert into memberships (organization_id, user_id, role)
    values (invited_org_id, new.id, invited_role)
    on conflict (organization_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- create_organization_with_admin
-- Called by a freshly signed-up user (no organization yet) to create their
-- organization, make themselves admin, and seed a default board with
-- starter statuses and ticket types.
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

  return new_org_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- move_ticket
-- Atomically updates a ticket's status/sprint and appends a ticket_history
-- row. Runs with the caller's own privileges, so normal RLS policies on
-- tickets/ticket_history still apply (the caller must already be able to
-- update the ticket and insert history for its organization).
-- ----------------------------------------------------------------------------

create or replace function move_ticket(
  p_ticket_id uuid,
  p_new_status_id uuid default null,
  p_new_sprint_id uuid default null,
  p_sprint_explicitly_set boolean default false
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_status_id uuid;
  current_sprint_id uuid;
  resolved_status_id uuid;
  resolved_sprint_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select status_id, sprint_id
  into current_status_id, current_sprint_id
  from tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket not found';
  end if;

  resolved_status_id := coalesce(p_new_status_id, current_status_id);
  resolved_sprint_id := case
    when p_sprint_explicitly_set then p_new_sprint_id
    else coalesce(p_new_sprint_id, current_sprint_id)
  end;

  if resolved_status_id = current_status_id
     and resolved_sprint_id is not distinct from current_sprint_id then
    return;
  end if;

  update tickets
  set status_id = resolved_status_id,
      sprint_id = resolved_sprint_id
  where id = p_ticket_id;

  insert into ticket_history (
    ticket_id, from_status_id, to_status_id,
    from_sprint_id, to_sprint_id, moved_by
  )
  values (
    p_ticket_id, current_status_id, resolved_status_id,
    current_sprint_id, resolved_sprint_id, auth.uid()
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- keep layout_preferences.updated_at current
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger layout_preferences_set_updated_at
  before update on layout_preferences
  for each row execute function set_updated_at();
