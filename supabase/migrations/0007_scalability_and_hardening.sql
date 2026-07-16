-- ============================================================================
-- 0007_scalability_and_hardening.sql
-- Addresses Supabase advisor findings (missing indexes, RLS re-evaluating
-- auth.uid() per row, duplicate permissive policies) plus a real
-- correctness/security gap found in code review: nothing stopped an
-- organization's last admin from removing or demoting themselves, which
-- would permanently lock the org out of admin-gated features (invites,
-- settings) with no recovery path.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Missing indexes on foreign keys (flagged by the performance advisor).
-- ticket_history is an append-only audit log that only grows — these matter
-- more over time, not less.
-- ----------------------------------------------------------------------------

create index if not exists tickets_created_by_idx on tickets (created_by);
create index if not exists tickets_type_id_idx on tickets (type_id);

create index if not exists ticket_history_from_status_id_idx on ticket_history (from_status_id);
create index if not exists ticket_history_to_status_id_idx on ticket_history (to_status_id);
create index if not exists ticket_history_from_sprint_id_idx on ticket_history (from_sprint_id);
create index if not exists ticket_history_to_sprint_id_idx on ticket_history (to_sprint_id);
create index if not exists ticket_history_moved_by_idx on ticket_history (moved_by);

-- ----------------------------------------------------------------------------
-- RLS: stop re-evaluating auth.uid() per row. Wrapping in `(select ...)`
-- lets Postgres treat it as a stable subplan evaluated once per query
-- instead of once per row — matters increasingly as tables grow.
-- ----------------------------------------------------------------------------

drop policy "users can view own profile" on profiles;
drop policy "users can view profiles of org-mates" on profiles;

-- Also merges what were two separate permissive SELECT policies (each
-- evaluated independently and OR'd together by Postgres) into one, per
-- the "multiple_permissive_policies" advisor finding.
create policy "users can view own or org-mates profiles"
  on profiles for select
  using (
    id = (select auth.uid())
    or exists (
      select 1 from memberships m1
      join memberships m2 on m1.organization_id = m2.organization_id
      where m1.user_id = (select auth.uid()) and m2.user_id = profiles.id
    )
  );

drop policy "users can update own profile" on profiles;
create policy "users can update own profile"
  on profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy "users can view own layout preferences" on layout_preferences;
create policy "users can view own layout preferences"
  on layout_preferences for select
  using (user_id = (select auth.uid()));

drop policy "users can create own layout preferences" on layout_preferences;
create policy "users can create own layout preferences"
  on layout_preferences for insert
  with check (user_id = (select auth.uid()));

drop policy "users can update own layout preferences" on layout_preferences;
create policy "users can update own layout preferences"
  on layout_preferences for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy "users can delete own layout preferences" on layout_preferences;
create policy "users can delete own layout preferences"
  on layout_preferences for delete
  using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- Prevent an organization from ever ending up with zero admins.
-- Defense in depth: the app (src/lib/members/actions.ts) also pre-checks
-- this for a cleaner UX, but this trigger is the real authority — it
-- covers direct REST/RPC access too, not just the app's own code paths.
-- ----------------------------------------------------------------------------

create or replace function prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count integer;
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    select count(*) into admin_count
    from memberships
    where organization_id = old.organization_id and role = 'admin';

    if admin_count <= 1 then
      raise exception 'Cannot remove or demote the last admin of an organization';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger memberships_prevent_last_admin_removal
  before update or delete on memberships
  for each row execute function prevent_last_admin_removal();

-- ----------------------------------------------------------------------------
-- Tickets: validate cross-references belong together. Nothing previously
-- stopped an authenticated member of org A from inserting/updating a
-- ticket with organization_id = A (passes RLS) but board_id/status_id/
-- sprint_id/client_id/type_id borrowed from a completely different org's
-- UUIDs. RLS's organization_id check meant org B's members could never
-- actually see such a row (it wouldn't match their board_id query either),
-- so this wasn't a cross-org data leak — but it was corrupt, orphaned data
-- with no integrity guarantee. This closes that gap for both direct
-- table writes and the move_ticket RPC (which just does a plain UPDATE
-- under the hood, so it's covered by the same trigger).
-- ----------------------------------------------------------------------------

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

  return new;
end;
$$;

create trigger tickets_validate_references
  before insert or update on tickets
  for each row execute function validate_ticket_references();
