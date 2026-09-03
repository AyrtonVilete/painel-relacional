import { endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { PDVNET_CLOSED_STATES, PDVNET_CUSTOMER_TAGS } from "@/lib/pdvnet/constants";
import type { Tables } from "@/types/database.types";

type PdvnetTicket = Tables<"pdvnet_tickets">;

export type PdvnetFilters = {
  clientes: string[];
  tags: string[];
  devOwners: string[];
  types: string[];
  states: string[];
  sistemas: string[];
  createdFrom: string;
  createdTo: string;
};

export const DEFAULT_PDVNET_FILTERS: PdvnetFilters = {
  clientes: [],
  tags: [],
  devOwners: [],
  types: [],
  states: [],
  sistemas: [],
  createdFrom: "",
  createdTo: "",
};

export function hasActivePdvnetFilters(filters: PdvnetFilters) {
  return (
    filters.clientes.length > 0 ||
    filters.tags.length > 0 ||
    filters.devOwners.length > 0 ||
    filters.types.length > 0 ||
    filters.states.length > 0 ||
    filters.sistemas.length > 0 ||
    filters.createdFrom !== "" ||
    filters.createdTo !== ""
  );
}

function clientLabel(t: PdvnetTicket) {
  return t.cliente?.trim() || "Sem cliente";
}
function systemLabel(t: PdvnetTicket) {
  return t.sistema?.trim() || "Sem sistema";
}
function ownerLabel(t: PdvnetTicket) {
  return t.dev_owner?.trim() || t.assigned_to?.trim() || "Sem responsável";
}

export function pdvnetFilterOptions(tickets: PdvnetTicket[]) {
  const uniqSorted = (values: string[]) =>
    Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    clientes: uniqSorted(tickets.map(clientLabel)),
    tags: [...PDVNET_CUSTOMER_TAGS],
    devOwners: uniqSorted(tickets.map(ownerLabel)),
    types: uniqSorted(tickets.map((t) => t.work_item_type)),
    states: uniqSorted(tickets.map((t) => t.state)),
    sistemas: uniqSorted(tickets.map(systemLabel)),
  };
}

export function filterPdvnetTickets(
  tickets: PdvnetTicket[],
  filters: PdvnetFilters
): PdvnetTicket[] {
  return tickets.filter((t) => {
    if (filters.clientes.length && !filters.clientes.includes(clientLabel(t))) {
      return false;
    }
    if (filters.tags.length && !filters.tags.some((tag) => t.tags.includes(tag))) {
      return false;
    }
    if (filters.devOwners.length && !filters.devOwners.includes(ownerLabel(t))) {
      return false;
    }
    if (filters.types.length && !filters.types.includes(t.work_item_type)) {
      return false;
    }
    if (filters.states.length && !filters.states.includes(t.state)) {
      return false;
    }
    if (filters.sistemas.length && !filters.sistemas.includes(systemLabel(t))) {
      return false;
    }
    if (filters.createdFrom) {
      if (!t.created_date || t.created_date.slice(0, 10) < filters.createdFrom) {
        return false;
      }
    }
    if (filters.createdTo) {
      if (!t.created_date || t.created_date.slice(0, 10) > filters.createdTo) {
        return false;
      }
    }
    return true;
  });
}

function isOpen(ticket: PdvnetTicket) {
  return !PDVNET_CLOSED_STATES.includes(ticket.state);
}

function ageInDays(fromIso: string | null, toIso?: string | null) {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  return (to - from) / (1000 * 60 * 60 * 24);
}

function topN(counts: Map<string, number>, n: number) {
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

function countBy<T>(items: T[], keyFn: (item: T) => string, n = 12) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return topN(counts, n);
}

function avgOf(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const AGING_BUCKETS = [
  { name: "0-7 dias", min: 0, max: 7 },
  { name: "7-30 dias", min: 7, max: 30 },
  { name: "30-90 dias", min: 30, max: 90 },
  { name: "90+ dias", min: 90, max: Infinity },
];

export function computePdvnetStats(tickets: PdvnetTicket[]) {
  const open = tickets.filter(isOpen);
  const closed = tickets.filter((t) => !isOpen(t));

  const byClient = countBy(open, clientLabel, 10);
  const bySystem = countBy(open, systemLabel, 10);
  const byType = countBy(open, (t) => t.work_item_type, 10);
  const byDevOwner = countBy(open, ownerLabel, 10);

  const byTag = PDVNET_CUSTOMER_TAGS.map((tag) => {
    const total = tickets.filter((t) => t.tags.includes(tag)).length;
    const openCount = open.filter((t) => t.tags.includes(tag)).length;
    return { name: tag, aberto: openCount, fechado: total - openCount };
  }).filter((t) => t.aberto + t.fechado > 0);

  const priorityCounts = new Map<string, number>();
  for (const t of open) {
    const label = t.priority ? `P${t.priority}` : "Sem prioridade";
    priorityCounts.set(label, (priorityCounts.get(label) ?? 0) + 1);
  }
  const byPriority = Array.from(priorityCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const agingBuckets = AGING_BUCKETS.map((bucket) => ({
    name: bucket.name,
    value: open.filter((t) => {
      const age = ageInDays(t.created_date);
      return age !== null && age >= bucket.min && age < bucket.max;
    }).length,
  }));

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
      ageDays: Math.round(ageInDays(t.created_date) ?? 0),
    }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const resolutionDays = closed
    .map((t) => ageInDays(t.created_date, t.closed_date))
    .filter((d): d is number => d !== null && d >= 0);
  const avgResolutionDays = avgOf(resolutionDays);

  // Funnel stage durations: each stage computed independently over
  // whichever tickets have both of that stage's boundary dates populated
  // (Custom.ApprovedDate/CommitedDate/QADate are filled in manually by the
  // team as a ticket progresses, so most tickets only have a subset).
  const stageAguardandoAprovacao = avgOf(
    tickets
      .map((t) => ageInDays(t.created_date, t.approved_date))
      .filter((d): d is number => d !== null && d >= 0)
  );
  const stageAprovadoCommit = avgOf(
    tickets
      .map((t) => ageInDays(t.approved_date, t.committed_date))
      .filter((d): d is number => d !== null && d >= 0)
  );
  const stageCommitQa = avgOf(
    tickets
      .map((t) => ageInDays(t.committed_date, t.qa_date))
      .filter((d): d is number => d !== null && d >= 0)
  );
  const stageQaConcluido = avgOf(
    tickets
      .map((t) => ageInDays(t.qa_date, t.closed_date))
      .filter((d): d is number => d !== null && d >= 0)
  );

  const funnelStages = [
    { name: "Criado → Aprovado", days: stageAguardandoAprovacao },
    { name: "Aprovado → Commit", days: stageAprovadoCommit },
    { name: "Commit → QA", days: stageCommitQa },
    { name: "QA → Concluído", days: stageQaConcluido },
  ].filter((s): s is { name: string; days: number } => s.days !== null);

  // Last 8 weeks, same window/labeling convention as the main dashboard's
  // throughput chart.
  const now = new Date();
  const weeklyTrend = Array.from({ length: 8 }).map((_, i) => {
    const start = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });
    const criados = tickets.filter((t) => {
      if (!t.created_date) return false;
      const d = new Date(t.created_date);
      return d >= start && d <= end;
    }).length;
    const fechados = tickets.filter((t) => {
      if (!t.closed_date) return false;
      const d = new Date(t.closed_date);
      return d >= start && d <= end;
    }).length;
    return { name: format(start, "dd/MM"), criados, fechados };
  });

  return {
    totalOpen: open.length,
    totalClosed: closed.length,
    total: tickets.length,
    byClient,
    byTag,
    byDevOwner,
    bySystem,
    byType,
    byPriority,
    agingBuckets,
    funnelStages,
    weeklyTrend,
    urgentQueue,
    avgResolutionDays,
    lastSyncedAt: tickets.reduce<string | null>((latest, t) => {
      if (!t.synced_at) return latest;
      return !latest || t.synced_at > latest ? t.synced_at : latest;
    }, null),
  };
}
