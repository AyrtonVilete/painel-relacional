import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTicketEvent } from "@/lib/notifications/send-ticket-notification";
import { verifyWebhookSecret } from "@/lib/notifications/verify-webhook";

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const ticketId = payload.ticket_id as string;
  const fromStatusId = payload.from_status_id as string | null;
  const toStatusId = payload.to_status_id as string | null;
  const movedBy = payload.moved_by as string | null;

  if (!ticketId || fromStatusId === toStatusId || !toStatusId) {
    // Sprint-only change, or no actual status move — nothing to notify.
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const { data: status } = await supabase
    .from("statuses")
    .select("name")
    .eq("id", toStatusId)
    .maybeSingle();

  await notifyTicketEvent({
    ticketId,
    actorId: movedBy,
    subject: `Novo status: ${status?.name ?? "—"}`,
    bodyHtml: `<p>O status foi alterado para <strong>${status?.name ?? "—"}</strong>.</p>`,
  });

  return NextResponse.json({ ok: true });
}
