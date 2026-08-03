// Shared by create-ticket-dialog.tsx and ticket-detail-dialog.tsx so the
// title/ticket-number validation can't drift between the two forms the
// way it previously had (each dialog re-implemented this check inline).
export function parseTicketFormFields(formData: FormData): {
  title: string;
  ticketNumber: number;
  error: string | null;
} {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return { title, ticketNumber: 0, error: "Informe um título" };
  }

  const ticketNumberRaw = String(formData.get("ticketNumber") ?? "").trim();
  const ticketNumber = Number(ticketNumberRaw);
  if (!ticketNumberRaw || !Number.isInteger(ticketNumber) || ticketNumber <= 0) {
    return { title, ticketNumber: 0, error: "Informe o número do chamado" };
  }

  return { title, ticketNumber, error: null };
}
