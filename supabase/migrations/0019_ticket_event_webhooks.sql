-- ============================================================================
-- 0019_ticket_event_webhooks.sql
-- Fires an async HTTP call (via pg_net) to the app's /api/notifications
-- routes whenever a ticket_history or ticket_comments row is inserted, so
-- email notifications can be sent without every client-side mutation path
-- (move_ticket RPC, direct .update() calls, the new comment insert) having
-- to remember to also trigger a notification — the DB is already the single
-- source of truth for "this event happened" for both tables.
--
-- The shared secret used to authenticate the webhook call is stored in
-- Supabase Vault (inserted separately via execute_sql, NOT in this file —
-- this repo's history is otherwise clean of committed secrets and this
-- keeps it that way) and read at call time via vault.decrypted_secrets.
-- The API route compares it against the SUPABASE_WEBHOOK_SECRET env var.
-- ============================================================================

create extension if not exists pg_net;

create or replace function notify_ticket_history_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'ticket_webhook_secret';

  perform net.http_post(
    url := 'https://painel-relacional.vercel.app/api/notifications/ticket-history',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'history_id', new.id,
      'ticket_id', new.ticket_id,
      'from_status_id', new.from_status_id,
      'to_status_id', new.to_status_id,
      'moved_by', new.moved_by
    )
  );
  return new;
end;
$$;

-- Revoking from PUBLIC alone is a no-op here — this project's default
-- privileges grant EXECUTE directly to anon/authenticated on function
-- creation, not via PUBLIC (same gotcha hit in 0005->0006 and 0008->0009,
-- confirmed again by checking pg_proc.proacl after applying).
revoke execute on function notify_ticket_history_created() from anon, authenticated;

create trigger ticket_history_notify
  after insert on ticket_history
  for each row execute function notify_ticket_history_created();

create or replace function notify_ticket_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'ticket_webhook_secret';

  perform net.http_post(
    url := 'https://painel-relacional.vercel.app/api/notifications/ticket-comment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'comment_id', new.id,
      'ticket_id', new.ticket_id,
      'author_id', new.author_id
    )
  );
  return new;
end;
$$;

revoke execute on function notify_ticket_comment_created() from anon, authenticated;

create trigger ticket_comments_notify
  after insert on ticket_comments
  for each row execute function notify_ticket_comment_created();
