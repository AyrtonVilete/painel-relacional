-- ============================================================================
-- 0025_notifications.sql
-- In-app notifications, first use case: @mentions in ticket_comments. Same
-- shape/RLS pattern as ticket_comments/ticket_attachments — append-only,
-- scoped via the existing ticket_org_id(ticket_id) helper — except a
-- notification also needs an update policy so the recipient can mark their
-- own row read.
-- ============================================================================

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  ticket_id uuid not null references tickets (id) on delete cascade,
  comment_id uuid references ticket_comments (id) on delete cascade,
  body_preview text not null check (char_length(body_preview) <= 200),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx on notifications (recipient_id, read_at);
create index notifications_ticket_id_idx on notifications (ticket_id);

alter table notifications enable row level security;

create policy "users can view their own notifications"
  on notifications for select
  using (recipient_id = (select auth.uid()));

create policy "org members can create notifications for other org members"
  on notifications for insert
  with check (
    is_org_member(ticket_org_id(ticket_id))
    and actor_id = (select auth.uid())
  );

create policy "users can mark their own notifications as read"
  on notifications for update
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
