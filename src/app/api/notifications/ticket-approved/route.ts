import { NextResponse } from "next/server";
import { notifyTicketEvent } from "@/lib/notifications/send-ticket-notification";
import { verifyWebhookSecret } from "@/lib/notifications/verify-webhook";

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const ticketId = payload.ticket_id as string;
  const approvedBy = payload.approved_by as string | null;

  if (!ticketId) {
    return NextResponse.json({ ok: true });
  }

  await notifyTicketEvent({
    ticketId,
    actorId: approvedBy,
    subject: "Chamado aprovado",
    bodyHtml: `<p>O chamado foi aprovado.</p>`,
  });

  return NextResponse.json({ ok: true });
}
