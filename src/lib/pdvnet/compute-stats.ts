import { PDVNET_CLOSED_STATES, PDVNET_CUSTOMER_TAGS } from "@/lib/pdvnet/constants";
import type { Tables } from "@/types/database.types";

type PdvnetTicket = Tables<"pdvnet_tickets">;

function isOpen(ticket: PdvnetTicket) {
  return !PDVNET_CLOSED_STATES.includes(ticket.state);
}

function ageInDays(ticket: PdvnetTicket) {
  if (!ticket.created_date) return 0;
  const created = new Date(ticket.created_date).getTime();
  return (Date.now() - created) / (1000 * 60 * 60 * 24);
}

export function computePdvnetStats(tickets: PdvnetTicket[]) {
  const open = tickets.filter(isOpen);
  const closed = tickets.filter((t) => !isOpen(t));

  const byClientCount = new Map<string, number>();
  for (const t of open) {
    const client = t.cliente?.trim() || "Sem cliente";
    byClientCount.set(client, (byClientCount.get(client) ?? 0) + 1);
  }
  const byClient = Array.from(byClientCount.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const byTag = PDVNET_CUSTOMER_TAGS.map((tag) => {
    const total = tickets.filter((t) => t.tags.includes(tag)).length;
    const openCount = open.filter((t) => t.tags.includes(tag)).length;
    return { name: tag, aberto: openCount, fechado: total - openCount };
  }).filter((t) => t.aberto + t.fechado > 0);

  const byDevOwnerCount = new Map<string, number>();
  for (const t of open) {
    const owner = t.dev_owner?.trim() || t.assigned_to?.trim() || "Sem responsável";
    byDevOwnerCount.set(owner, (byDevOwnerCount.get(owner) ?? 0) + 1);
  }
  const byDevOwner = Array.from(byDevOwnerCount.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const urgentQueue = open
    .filter((t) => t.tags.includes("Urgente"))
    .map((t) => ({
      id: t.id,
      adoId: t.ado_id,
      title: t.title,
      state: t.state,
      cliente: t.cliente,
      chamado: t.chamado,
      devOwner: t.dev_owner ?? t.assigned_to,
      ageDays: Math.round(ageInDays(t)),
    }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const resolutionDays = closed
    .map((t) => {
      if (!t.created_date || !t.closed_date) return null;
      const created = new Date(t.created_date).getTime();
      const closedAt = new Date(t.closed_date).getTime();
      return (closedAt - created) / (1000 * 60 * 60 * 24);
    })
    .filter((d): d is number => d !== null && d >= 0);

  const avgResolutionDays =
    resolutionDays.length > 0
      ? resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length
      : null;

  return {
    totalOpen: open.length,
    totalClosed: closed.length,
    total: tickets.length,
    byClient,
    byTag,
    byDevOwner,
    urgentQueue,
    avgResolutionDays,
    lastSyncedAt: tickets.reduce<string | null>((latest, t) => {
      if (!t.synced_at) return latest;
      return !latest || t.synced_at > latest ? t.synced_at : latest;
    }, null),
  };
}
