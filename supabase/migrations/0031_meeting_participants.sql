-- ============================================================================
-- 0031_meeting_participants.sql
-- Lets a meeting creator (or admin) @mention org members as participants,
-- same picker pattern already used for ticket_comments mentions. Adds the
-- join table plus a meeting_org_id() helper mirroring ticket_org_id(), and
-- extends notifications (previously ticket-only) so a meeting invite can
-- notify through the same bell.
-- ============================================================================

create table meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

create index meeting_participants_meeting_id_idx on meeting_participants (meeting_id);
create index meeting_participants_user_id_idx on meeting_participants (user_id);

create or replace function meeting_org_id(p_meeting_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from meetings where id = p_meeting_id;
$$;

alter table meeting_participants enable row level security;

create policy "org members can view meeting participants"
  on meeting_participants for select
  using (is_org_member(meeting_org_id(meeting_id)));

-- Managing the participant list is restricted the same way as editing the
-- meeting itself (creator or admin) — a regular member shouldn't be able to
-- add/remove invitees on someone else's meeting.
create policy "meeting creator or admin can add participants"
  on meeting_participants for insert
  with check (
    added_by = (select auth.uid())
    and exists (
      select 1 from meetings m
      where m.id = meeting_id
        and (m.created_by = (select auth.uid()) or is_org_admin(m.organization_id))
    )
  );

create policy "meeting creator or admin can remove participants"
  on meeting_participants for delete
  using (
    exists (
      select 1 from meetings m
      where m.id = meeting_id
        and (m.created_by = (select auth.uid()) or is_org_admin(m.organization_id))
    )
  );

-- ----------------------------------------------------------------------------
-- notifications: was ticket-only (ticket_id not null). Meeting invites reuse
-- the same table/bell, so ticket_id becomes optional and meeting_id is added,
-- with a check that exactly one kind of target is always present.
-- ----------------------------------------------------------------------------

alter table notifications alter column ticket_id drop not null;
alter table notifications add column meeting_id uuid references meetings (id) on delete cascade;

alter table notifications add constraint notifications_target_check
  check (
    (ticket_id is not null and meeting_id is null)
    or (ticket_id is null and meeting_id is not null)
  );

drop policy "org members can create notifications for other org members" on notifications;

create policy "org members can create notifications for other org members"
  on notifications for insert
  with check (
    actor_id = (select auth.uid())
    and (
      (ticket_id is not null and is_org_member(ticket_org_id(ticket_id)))
      or (meeting_id is not null and is_org_member(meeting_org_id(meeting_id)))
    )
  );
