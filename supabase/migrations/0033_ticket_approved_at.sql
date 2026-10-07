-- ============================================================================
-- 0033_ticket_approved_at.sql
--
-- Records WHEN a chamado was approved and BY WHOM, so the board can filter and
-- export "chamados aprovados entre tais dias".
--
-- The two columns are written only by a trigger, never by the app: whatever a
-- client sends for approved_at / approved_by is discarded. They are set the
-- moment `approved` flips false -> true (the "Aprovar" button) and are not
-- touched by later edits. A session with no end-user identity (auth.uid() is
-- null: the Supabase SQL editor, the service role) is trusted and may correct
-- them by hand.
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- ============================================================================

begin;

alter table tickets
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users (id) on delete set null;

-- Chamados approved before this migration have no recorded click. Best
-- available evidence: the latest move into a column flagged "coluna de
-- aprovados" (the Aprovar button moves the card there and logs it in
-- ticket_history). Approved chamados with no such move stay NULL — shown as
-- "sem data" rather than guessing one. Runs before the trigger exists.
update tickets t
set approved_at = h.moved_at,
    approved_by = h.moved_by
from (
  select distinct on (th.ticket_id) th.ticket_id, th.moved_at, th.moved_by
  from ticket_history th
  join statuses s on s.id = th.to_status_id
  where s.is_approved
  order by th.ticket_id, th.moved_at desc
) h
where t.id = h.ticket_id
  and t.approved
  and t.approved_at is null;

create or replace function set_ticket_approval_audit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  trusted boolean := auth.uid() is null;
begin
  if tg_op = 'INSERT' then
    if new.approved then
      if not trusted or new.approved_at is null then
        new.approved_at := now();
        new.approved_by := auth.uid();
      end if;
    else
      new.approved_at := null;
      new.approved_by := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if not new.approved then
    new.approved_at := null;
    new.approved_by := null;
  elsif not old.approved then
    -- the approval click
    if not trusted or new.approved_at is null then
      new.approved_at := now();
      new.approved_by := auth.uid();
    end if;
  elsif not trusted then
    -- already approved: the stamp is frozen for end users
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
  end if;

  return new;
end;
$$;

-- Named so it fires after tickets_enforce_approval_permission (triggers run
-- alphabetically): unauthorised approvals are rejected before being stamped.
drop trigger if exists tickets_set_approval_audit on tickets;
create trigger tickets_set_approval_audit
  before insert or update on tickets
  for each row execute function set_ticket_approval_audit();

create index if not exists tickets_approved_at_idx
  on tickets (organization_id, approved_at)
  where approved_at is not null;

commit;

-- Check (read-only): how many approved chamados have a date.
select
  count(*) filter (where approved)                         as aprovados,
  count(*) filter (where approved and approved_at is not null) as com_data,
  count(*) filter (where approved and approved_at is null)     as sem_data
from tickets;
