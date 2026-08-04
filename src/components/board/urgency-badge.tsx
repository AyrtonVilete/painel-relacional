import { clsx } from "clsx";
import type { Database } from "@/types/database.types";

type TicketUrgency = Database["public"]["Enums"]["ticket_urgency"];

const URGENCY_STYLES: Record<TicketUrgency, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  critical: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const URGENCY_LABELS: Record<TicketUrgency, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export function UrgencyBadge({ urgency }: { urgency: TicketUrgency }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        URGENCY_STYLES[urgency]
      )}
    >
      {URGENCY_LABELS[urgency]}
    </span>
  );
}

// Most urgent first — used to sort tickets within a column so the ones
// that matter most surface at the top instead of just showing registration
// order.
const URGENCY_RANK: Record<TicketUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export { URGENCY_LABELS, URGENCY_RANK };
