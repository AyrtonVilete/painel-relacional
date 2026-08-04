-- ============================================================================
-- 0017_ticket_attachments.sql
-- Allows attaching files (screenshots, logs) to a ticket. Two parts:
-- 1) a private Storage bucket, path convention
--    {organization_id}/{ticket_id}/{filename}, RLS on storage.objects scoped
--    via the org id embedded in the path (same is_org_member() helper used
--    everywhere else).
-- 2) a side table (Storage alone can't answer "which attachments does this
--    ticket have" with friendly metadata + org-scoped RLS in one query) —
--    same append-only shape as ticket_history/ticket_comments.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  10485760, -- 10MB
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv', 'application/json',
    'application/zip'
  ]
)
on conflict (id) do nothing;

create policy "org members can view ticket attachment files"
  on storage.objects for select
  using (
    bucket_id = 'ticket-attachments'
    and is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "org members can upload ticket attachment files"
  on storage.objects for insert
  with check (
    bucket_id = 'ticket-attachments'
    and is_org_member(((storage.foldername(name))[1])::uuid)
  );

create table ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id),
  file_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_size bigint not null check (file_size > 0),
  content_type text not null,
  created_at timestamptz not null default now()
);

create index ticket_attachments_ticket_id_idx on ticket_attachments (ticket_id);
create index ticket_attachments_uploaded_by_idx on ticket_attachments (uploaded_by);

alter table ticket_attachments enable row level security;

create policy "org members can view ticket attachments"
  on ticket_attachments for select
  using (is_org_member(ticket_org_id(ticket_id)));

create policy "org members can add ticket attachments"
  on ticket_attachments for insert
  with check (
    is_org_member(ticket_org_id(ticket_id))
    and uploaded_by = (select auth.uid())
  );
