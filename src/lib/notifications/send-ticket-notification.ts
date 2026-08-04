import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

// Sandbox sender: no custom domain is verified in Resend yet (see
// project notes), so onboarding@resend.dev only actually delivers to the
// Resend account owner's own verified email. Swap this for a
// `noreply@${process.env.RESEND_EMAIL_DOMAIN}` address once a real domain
// is verified — no other code changes needed.
const FROM_ADDRESS = "Painel Relacional <onboarding@resend.dev>";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function notifyTicketEvent({
  ticketId,
  actorId,
  subject,
  bodyHtml,
}: {
  ticketId: string;
  actorId: string | null;
  subject: string;
  bodyHtml: string;
}) {
  const supabase = createAdminClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, organization_id, created_by, ticket_number, title")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) return;

  const { data: admins } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", ticket.organization_id)
    .eq("role", "admin");

  const recipientIds = new Set(
    [ticket.created_by, ...(admins ?? []).map((a) => a.user_id)].filter(
      (id): id is string => Boolean(id)
    )
  );

  if (actorId) recipientIds.delete(actorId);
  if (recipientIds.size === 0) return;

  const emails: string[] = [];
  for (const userId of Array.from(recipientIds)) {
    const { data } = await supabase.auth.admin.getUserById(userId);
    if (data.user?.email) emails.push(data.user.email);
  }

  if (emails.length === 0) return;

  const fullSubject = `[Chamado #${ticket.ticket_number}] ${subject}`;
  const html = `
    <p><strong>${escapeHtml(ticket.title)}</strong> (chamado #${ticket.ticket_number})</p>
    ${bodyHtml}
    <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/board">Ver no painel</a></p>
  `;

  await Promise.all(
    emails.map(async (to) => {
      const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: fullSubject,
        html,
      });
      if (error) {
        console.error("Failed to send ticket notification email", { to, error });
      }
    })
  );
}
