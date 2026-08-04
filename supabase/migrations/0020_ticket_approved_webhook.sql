-- ============================================================================
-- 0020_ticket_approved_webhook.sql
-- Approval doesn't go through move_ticket/ticket_history (it's a plain
-- tickets.approved flip via .update() in ticket-detail-dialog.tsx), so it
-- needs its own trigger to notify — same pg_net + vault pattern as
-- 0019_ticket_event_webhooks.sql.
-- ============================================================================

create or replace function notify_ticket_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_secret text;
begin
  if new.approved = true and old.approved = false then
    select decrypted_secret into webhook_secret
    from vault.decrypted_secrets
    where name = 'ticket_webhook_secret';

    perform net.http_post(
      url := 'https://painel-relacional.vercel.app/api/notifications/ticket-approved',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object('ticket_id', new.id, 'approved_by', auth.uid())
    );
  end if;
  return new;
end;
$$;

-- Checked pg_proc.proacl after applying rather than assuming: this
-- function's default grant landed on PUBLIC (unlike the two in 0019,
-- which landed directly on anon/authenticated) — this project's default
-- privileges have varied both ways before, so revoke both forms.
revoke execute on function notify_ticket_approved() from public;
revoke execute on function notify_ticket_approved() from anon, authenticated;

create trigger tickets_notify_approved
  after update on tickets
  for each row execute function notify_ticket_approved();
