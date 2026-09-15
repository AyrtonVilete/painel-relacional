import { endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { URGENCY_LABELS } from "@/components/board/urgency-badge";
import type { Database } from "@/types/database.types";

type TicketUrgency = Database["public"]["Enums"]["ticket_urgency"];

export const URGENCY_ORDER: TicketUrgency[] = ["low", "medium", "high", "critical"];

// Deadline used to bucket "vence em breve" — matches the "cobrança" horizon
// used elsewhere in the app, not an arbitrary choice.
const DUE_SOON_DAYS = 3;

export type DashboardTicket = {
  id: string;
  status_id: string;
  urgency: TicketUrgency;
  approved: boolean;
  deadline: string | null;
  execution_deadline: string | null;
  next_followup_due: string | null;
  sprint_id: string | null;
  developer_id: string | null;
  client_id: string | null;
  type_id: string | null;
  created_by: string;
  created_at: string;
};

type StatusLite = {
  id: string;
  name: string;
  is_terminal: boolean;
  is_denied: boolean;
  is_awaiting_approval: boolean;
};

type NamedEntity = { id: string; name: string };

type HistoryEntry = {
  ticket_id: string;
  to_status_id: string | null;
  moved_at: string;
};

export function computeDashboardStats({
  tickets,
  statuses,
  sprints,
  developers,
  clients,
  members,
  history,
}: {
  tickets: DashboardTicket[];
  statuses: StatusLite[];
  sprints: NamedEntity[];
  developers: NamedEntity[];
  clients: NamedEntity[];
  members: NamedEntity[];
  history: HistoryEntry[];
}) {
  const terminalStatusIds = new Set(
    statuses.filter((s) => s.is_terminal).map((s) => s.id)
  );
  const deniedStatusIds = new Set(
    statuses.filter((s) => s.is_denied).map((s) => s.id)
  );
  const awaitingApprovalStatusIds = new Set(
    statuses.filter((s) => s.is_awaiting_approval).map((s) => s.id)
  );

  // First moment each ticket entered a terminal status, if ever. Computed
  // from the full (unfiltered) history so a filtered-out earlier move still
  // resolves correctly — only the resulting map lookup is scoped to the
  // tickets passed in.
  const resolvedAtByTicket = new Map<string, string>();
  for (const entry of history) {
    if (resolvedAtByTicket.has(entry.ticket_id)) continue;
    if (entry.to_status_id && terminalStatusIds.has(entry.to_status_id)) {
      resolvedAtByTicket.set(entry.ticket_id, entry.moved_at);
    }
  }

  const resolutionDurationsMs = tickets
    .map((t) => {
      const resolvedAt = resolvedAtByTicket.get(t.id);
      return resolvedAt
        ? new Date(resolvedAt).getTime() - new Date(t.created_at).getTime()
        : null;
    })
    .filter((ms): ms is number => ms !== null);

  const avgResolutionDays =
    resolutionDurationsMs.length > 0
      ? resolutionDurationsMs.reduce((a, b) => a + b, 0) /
        resolutionDurationsMs.length /
        (1000 * 60 * 60 * 24)
      : null;

  const now = new Date();
  const throughput = Array.from({ length: 8 }).map((_, i) => {
    const start = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });

    const criados = tickets.filter((t) => {
      const d = new Date(t.created_at);
      return d >= start && d <= end;
    }).length;

    const resolvidos = tickets.filter((t) => {
      const resolvedAt = resolvedAtByTicket.get(t.id);
      if (!resolvedAt) return false;
      const d = new Date(resolvedAt);
      return d >= start && d <= end;
    }).length;

    return { name: format(start, "dd/MM"), criados, resolvidos };
  });

  const byDeveloper = [
    ...developers.map((d) => ({
      name: d.name,
      value: tickets.filter(
        (t) => t.developer_id === d.id && !terminalStatusIds.has(t.status_id)
      ).length,
    })),
    {
      name: "Sem desenvolvedor",
      value: tickets.filter(
        (t) => !t.developer_id && !terminalStatusIds.has(t.status_id)
      ).length,
    },
  ];

  // Every ticket ever registered under this person, not just the ones
  // still open — audit/reporting view ("quem registrou o quê"), unlike
  // byDeveloper above which is about current workload.
  const byRequester = members
    .map((m) => ({
      name: m.name,
      value: tickets.filter((t) => t.created_by === m.id).length,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const byClient = [
    ...clients.map((c) => ({
      name: c.name,
      value: tickets.filter((t) => t.client_id === c.id).length,
    })),
    {
      name: "Sem cliente",
      value: tickets.filter((t) => !t.client_id).length,
    },
  ].sort((a, b) => b.value - a.value);

  const today = now.toISOString().slice(0, 10);

  const totalTickets = tickets.length;
  const closedTickets = tickets.filter((t) =>
    terminalStatusIds.has(t.status_id)
  ).length;
  const openTickets = totalTickets - closedTickets;
  const pendingApproval = tickets.filter((t) => !t.approved).length;
  // Driven by the ticket's current column, not the `approved` flag — a
  // ticket dragged straight to "Aprovado" (unrestricted, doesn't require
  // clicking "Aprovar") should count against execution_deadline right
  // away, same reasoning as the ticket-card badge. Excludes terminal/
  // denied tickets — a resolved or rejected ticket isn't meaningfully
  // "atrasado" anymore.
  const overdue = tickets.filter((t) => {
    if (terminalStatusIds.has(t.status_id) || deniedStatusIds.has(t.status_id)) {
      return false;
    }
    const relevantDate = awaitingApprovalStatusIds.has(t.status_id)
      ? t.deadline
      : t.execution_deadline;
    return relevantDate !== null && relevantDate < today;
  }).length;
  const unassigned = tickets.filter((t) => !t.developer_id).length;
  // Recurring "cobrança de andamento" reminder from /settings/followup —
  // distinct from "overdue" above (one-shot approval/execution targets).
  const followupPending = tickets.filter(
    (t) =>
      t.next_followup_due !== null &&
      !terminalStatusIds.has(t.status_id) &&
      !deniedStatusIds.has(t.status_id) &&
      new Date(t.next_followup_due) < now
  ).length;
  const denied = tickets.filter((t) => deniedStatusIds.has(t.status_id)).length;

  const byStatus = statuses.map((s) => ({
    name: s.name,
    value: tickets.filter((t) => t.status_id === s.id).length,
  }));

  const byUrgency = URGENCY_ORDER.map((urgency) => ({
    name: URGENCY_LABELS[urgency],
    urgency,
    value: tickets.filter((t) => t.urgency === urgency).length,
  }));

  const bySprint = [
    ...sprints.map((s) => ({
      name: s.name,
      value: tickets.filter((t) => t.sprint_id === s.id).length,
    })),
    {
      name: "Sem sprint",
      value: tickets.filter((t) => !t.sprint_id).length,
    },
  ];

  // Não há um SLA formal de tempo-de-resolução nesta base (a tabela
  // sla_policies/coluna tickets.sla_due_at de 0021_sla_policies.sql nunca
  // chegou a existir no banco em produção — só followup_policies, o
  // lembrete recorrente de "cobrança de andamento" configurado em
  // /settings/followup). Por isso "cumprimento de SLA" aqui mede isso: por
  // urgência, entre os chamados em aberto com uma cobrança pendente
  // (next_followup_due definido), quantos já estouraram o próximo lembrete
  // vs. quantos ainda estão em dia.
  const slaCompliance = URGENCY_ORDER.map((urgency) => {
    const relevant = tickets.filter(
      (t) =>
        t.urgency === urgency &&
        t.next_followup_due !== null &&
        !terminalStatusIds.has(t.status_id) &&
        !deniedStatusIds.has(t.status_id)
    );
    let cumprido = 0;
    let estourado = 0;
    for (const t of relevant) {
      const dueDate = new Date(t.next_followup_due as string);
      if (now <= dueDate) {
        cumprido++;
      } else {
        estourado++;
      }
    }
    const total = relevant.length;
    return {
      name: URGENCY_LABELS[urgency],
      urgency,
      cumprido,
      estourado,
      total,
      pct: total > 0 ? Math.round((cumprido / total) * 100) : null,
    };
  });

  // Distribuição de prazo de execução, só para chamados em aberto
  // (exclui terminal/negado, mesmo critério de "overdue" acima).
  const openNonDenied = tickets.filter(
    (t) => !terminalStatusIds.has(t.status_id) && !deniedStatusIds.has(t.status_id)
  );
  const dueSoonThreshold = new Date(now);
  dueSoonThreshold.setDate(dueSoonThreshold.getDate() + DUE_SOON_DAYS);
  const dueSoonThresholdStr = dueSoonThreshold.toISOString().slice(0, 10);

  const withExecutionDeadline = openNonDenied.filter(
    (t) => t.execution_deadline !== null
  );
  const executionDeadlineBuckets = [
    {
      name: "Atrasado",
      value: withExecutionDeadline.filter(
        (t) => (t.execution_deadline as string) < today
      ).length,
    },
    {
      name: `Vence em até ${DUE_SOON_DAYS} dias`,
      value: withExecutionDeadline.filter(
        (t) =>
          (t.execution_deadline as string) >= today &&
          (t.execution_deadline as string) <= dueSoonThresholdStr
      ).length,
    },
    {
      name: "No prazo",
      value: withExecutionDeadline.filter(
        (t) => (t.execution_deadline as string) > dueSoonThresholdStr
      ).length,
    },
    {
      name: "Sem prazo definido",
      value: openNonDenied.length - withExecutionDeadline.length,
    },
  ];

  return {
    totalTickets,
    openTickets,
    closedTickets,
    pendingApproval,
    overdue,
    followupPending,
    denied,
    unassigned,
    avgResolutionDays,
    byStatus,
    byUrgency,
    bySprint,
    byClient,
    throughput,
    byDeveloper,
    byRequester,
    slaCompliance,
    executionDeadlineBuckets,
  };
}

export type DashboardStats = ReturnType<typeof computeDashboardStats>;
