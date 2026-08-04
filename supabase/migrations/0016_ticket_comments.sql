-- ============================================================================
-- 0016_ticket_comments.sql
-- Adds a comment thread per ticket, separate from ticket_history (which is
-- the append-only log of status/sprint moves, not a place for free-text
-- discussion). Same shape/RLS pattern as ticket_history: no organization_id
-- column, scoped via the existing ticket_org_id(ticket_id) helper.
-- ============================================================================

create table ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index ticket_comments_ticket_id_idx on ticket_comments (ticket_id);
create index ticket_comments_author_id_idx on ticket_comments (author_id);

alter table ticket_comments enable row level security;

-- append-only, same as ticket_history: select + insert only, no update/delete
create policy "org members can view ticket comments"
  on ticket_comments for select
  using (is_org_member(ticket_org_id(ticket_id)));

create policy "org members can add ticket comments"
  on ticket_comments for insert
  with check (
    is_org_member(ticket_org_id(ticket_id))
    and author_id = (select auth.uid())
  );
