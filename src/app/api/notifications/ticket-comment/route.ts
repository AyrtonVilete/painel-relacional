import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  escapeHtml,
  notifyTicketEvent,
} from "@/lib/notifications/send-ticket-notification";
import { verifyWebhookSecret } from "@/lib/notifications/verify-webhook";

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const ticketId = payload.ticket_id as string;
  const commentId = payload.comment_id as string;
  const authorId = payload.author_id as string | null;

  if (!ticketId || !commentId) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const { data: comment } = await supabase
    .from("ticket_comments")
    .select("body")
    .eq("id", commentId)
    .maybeSingle();

  await notifyTicketEvent({
    ticketId,
    actorId: authorId,
    subject: "Novo comentário",
    bodyHtml: `<blockquote>${escapeHtml(comment?.body ?? "")}</blockquote>`,
  });

  return NextResponse.json({ ok: true });
}
