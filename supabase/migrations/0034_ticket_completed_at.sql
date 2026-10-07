-- ============================================================================
-- 0034_ticket_completed_at.sql
--
-- 1. tickets.completed_at: when a chamado entered a terminal column
--    ("Concluído"). Stamped by a trigger, not editable from the app (same
--    approach as approved_at in 0033). Cleared if the chamado leaves the
--    terminal column again.
-- 2. ticket_history.moved_by becomes nullable: moves made by the daily
--    Azure DevOps sync have no signed-in person behind them. The board
--    shows those as "Sincronização com o DevOps".
--
-- A session with no end-user identity (auth.uid() is null: the SQL editor,
-- the service role the DevOps sync runs as) is trusted and may set
-- completed_at itself — the sync uses that to store DevOps's real closing
-- date instead of the moment the sync happened.
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- ============================================================================

begin;

alter table tickets add column if not exists completed_at timestamptz;

alter table ticket_history alter column moved_by drop not null;

-- Chamados already in a terminal column: best evidence is the latest move
-- into one (ticket_history). Those without such a move stay NULL. Runs
-- before the trigger exists.
update tickets t
set completed_at = h.moved_at
from (
  select distinct on (th.ticket_id) th.ticket_id, th.moved_at
  from ticket_history th
  join statuses s on s.id = th.to_status_id
  where s.is_terminal
  order by th.ticket_id, th.moved_at desc
) h
where t.id = h.ticket_id
  and t.completed_at is null
  and exists (select 1 from statuses s where s.id = t.status_id and s.is_terminal);

create or replace function set_ticket_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  trusted boolean := auth.uid() is null;
  now_terminal boolean;
  was_terminal boolean := false;
begin
  select coalesce(is_terminal, false) into now_terminal
  from statuses where id = new.status_id;
  now_terminal := coalesce(now_terminal, false);

  if tg_op = 'UPDATE' then
    select coalesce(is_terminal, false) into was_terminal
    from statuses where id = old.status_id;
    was_terminal := coalesce(was_terminal, false);
  end if;

  if not now_terminal then
    new.completed_at := null;
  elsif tg_op = 'INSERT' or not was_terminal then
    -- entering "Concluído" now
    if not trusted or new.completed_at is null then
      new.completed_at := now();
    end if;
  elsif not trusted then
    -- already concluded: the date is frozen for end users
    new.completed_at := old.completed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists tickets_set_completed_at on tickets;
create trigger tickets_set_completed_at
  before insert or update on tickets
  for each row execute function set_ticket_completed_at();

commit;

-- Check (read-only): chamados in a terminal column and how many have a date.
select
  count(*)                                         as concluidos,
  count(*) filter (where t.completed_at is not null) as com_data,
  count(*) filter (where t.completed_at is null)     as sem_data
from tickets t
join statuses s on s.id = t.status_id
where s.is_terminal;
