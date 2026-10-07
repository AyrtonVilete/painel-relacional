const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type FollowupFields = {
  next_followup_due: string | null;
  deadline: string | null;
  execution_deadline: string | null;
};

// "YYYY-MM-DD" of today in the machine's own calendar, for comparing against
// the `date` columns (deadline / execution_deadline).
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// A cobrança only makes sense once the chamado is late, so this returns
// null until the date it is being measured against has passed — Prazo while
// it awaits approval, Execução prevista afterwards (same rule as the date
// badge on the card).
//
// Once late, the cobrança is due as soon as the chamado became late, or at
// last cobrança + the urgency's interval (tickets.next_followup_due) if that
// is later — so a chamado that was just cobrado shows the next one ahead,
// and one that is newly late shows it due right away instead of the stale
// "created + interval" date the column alone gives.
export function effectiveFollowupDue(
  ticket: FollowupFields,
  isAwaitingApproval: boolean,
  today: string
): Date | null {
  if (!ticket.next_followup_due) return null;

  const relevantDate = isAwaitingApproval ? ticket.deadline : ticket.execution_deadline;
  if (!relevantDate || relevantDate >= today) return null;

  const lateSince = new Date(new Date(`${relevantDate}T00:00:00`).getTime() + ONE_DAY_MS);
  const next = new Date(ticket.next_followup_due);
  return next > lateSince ? next : lateSince;
}
