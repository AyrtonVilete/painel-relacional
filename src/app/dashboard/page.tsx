import { endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { URGENCY_LABELS } from "@/components/board/urgency-badge";
import type { Database } from "@/types/database.types";

type TicketUrgency = Database["public"]["Enums"]["ticket_urgency"];

const URGENCY_ORDER: TicketUrgency[] = ["low", "medium", "high", "critical"];

// Per-user data (membership role, org, tickets) — same caching caveat as
// /board: never let Next.js's fetch cache serve one user's response to a
// different user's request on this route.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  const { data: board } = await supabase
    .from("boards")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .limit(1)
    .maybeSingle();

  if (!board) {
    return null;
  }

  const [{ data: statuses }, { data: tickets }, { data: sprints }, { data: developers }] =
    await Promise.all([
      supabase
        .from("statuses")
        .select("id, name, is_terminal, is_denied, is_awaiting_approval")
        .eq("board_id", board.id)
        .order("order", { ascending: true }),
      supabase
        .from("tickets")
        .select(
          "id, status_id, urgency, approved, deadline, execution_deadline, next_followup_due, sprint_id, developer_id, created_at"
        )
        .eq("board_id", board.id),
      supabase
        .from("sprints")
        .select("id, name")
        .eq("board_id", board.id)
        .order("start_date", { ascending: true }),
      supabase
        .from("developers")
        .select("id, name")
        .eq("organization_id", membership.organization_id)
        .order("name"),
    ]);

  const safeTickets = tickets ?? [];
  const safeStatuses = statuses ?? [];
  const safeSprints = sprints ?? [];
  const safeDevelopers = developers ?? [];

  const terminalStatusIds = new Set(
    safeStatuses.filter((s) => s.is_terminal).map((s) => s.id)
  );
  const deniedStatusIds = new Set(
    safeStatuses.filter((s) => s.is_denied).map((s) => s.id)
  );
  const awaitingApprovalStatusIds = new Set(
    safeStatuses.filter((s) => s.is_awaiting_approval).map((s) => s.id)
  );

  const ticketIds = safeTickets.map((t) => t.id);
  const { data: history } =
    ticketIds.length > 0
      ? await supabase
          .from("ticket_history")
          .select("ticket_id, to_status_id, moved_at")
          .in("ticket_id", ticketIds)
          .order("moved_at", { ascending: true })
      : { data: [] };

  // First moment each ticket entered a terminal status, if ever.
  const resolvedAtByTicket = new Map<string, string>();
  for (const entry of history ?? []) {
    if (resolvedAtByTicket.has(entry.ticket_id)) continue;
    if (entry.to_status_id && terminalStatusIds.has(entry.to_status_id)) {
      resolvedAtByTicket.set(entry.ticket_id, entry.moved_at);
    }
  }

  const resolutionDurationsMs = safeTickets
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

    const criados = safeTickets.filter((t) => {
      const d = new Date(t.created_at);
      return d >= start && d <= end;
    }).length;

    const resolvidos = safeTickets.filter((t) => {
      const resolvedAt = resolvedAtByTicket.get(t.id);
      if (!resolvedAt) return false;
      const d = new Date(resolvedAt);
      return d >= start && d <= end;
    }).length;

    return { name: format(start, "dd/MM"), criados, resolvidos };
  });

  const byDeveloper = [
    ...safeDevelopers.map((d) => ({
      name: d.name,
      value: safeTickets.filter(
        (t) => t.developer_id === d.id && !terminalStatusIds.has(t.status_id)
      ).length,
    })),
    {
      name: "Sem desenvolvedor",
      value: safeTickets.filter(
        (t) => !t.developer_id && !terminalStatusIds.has(t.status_id)
      ).length,
    },
  ];

  const today = new Date().toISOString().slice(0, 10);

  const totalTickets = safeTickets.length;
  const pendingApproval = safeTickets.filter((t) => !t.approved).length;
  // Driven by the ticket's current column, not the `approved` flag — a
  // ticket dragged straight to "Aprovado" (unrestricted, doesn't require
  // clicking "Aprovar") should count against execution_deadline right
  // away, same reasoning as the ticket-card badge. Excludes terminal/
  // denied tickets — a resolved or rejected ticket isn't meaningfully
  // "atrasado" anymore.
  const overdue = safeTickets.filter((t) => {
    if (terminalStatusIds.has(t.status_id) || deniedStatusIds.has(t.status_id)) {
      return false;
    }
    const relevantDate = awaitingApprovalStatusIds.has(t.status_id)
      ? t.deadline
      : t.execution_deadline;
    return relevantDate !== null && relevantDate < today;
  }).length;
  const unassigned = safeTickets.filter((t) => !t.developer_id).length;
  // Recurring "cobrança de andamento" reminder from /settings/followup —
  // distinct from "overdue" above (one-shot approval/execution targets).
  const followupPending = safeTickets.filter(
    (t) =>
      t.next_followup_due !== null &&
      !terminalStatusIds.has(t.status_id) &&
      !deniedStatusIds.has(t.status_id) &&
      new Date(t.next_followup_due) < now
  ).length;
  const denied = safeTickets.filter((t) => deniedStatusIds.has(t.status_id)).length;

  const byStatus = safeStatuses.map((s) => ({
    name: s.name,
    value: safeTickets.filter((t) => t.status_id === s.id).length,
  }));

  const byUrgency = URGENCY_ORDER.map((urgency) => ({
    name: URGENCY_LABELS[urgency],
    urgency,
    value: safeTickets.filter((t) => t.urgency === urgency).length,
  }));

  const bySprint = [
    ...safeSprints.map((s) => ({
      name: s.name,
      value: safeTickets.filter((t) => t.sprint_id === s.id).length,
    })),
    {
      name: "Sem sprint",
      value: safeTickets.filter((t) => !t.sprint_id).length,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <AppHeader
        orgName={membership.organizations?.name ?? "Painel Relacional"}
        userEmail={user?.email}
        role={membership.role}
        isAdmin={membership.role === "admin"}
        active="dashboard"
      />

      <main className="mx-auto w-full max-w-[100rem] flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Visão geral dos chamados de {board.name}.
          </p>
        </div>

        <DashboardCharts
          totalTickets={totalTickets}
          pendingApproval={pendingApproval}
          overdue={overdue}
          followupPending={followupPending}
          denied={denied}
          unassigned={unassigned}
          avgResolutionDays={avgResolutionDays}
          byStatus={byStatus}
          byUrgency={byUrgency}
          bySprint={bySprint}
          throughput={throughput}
          byDeveloper={byDeveloper}
        />
      </main>
    </div>
  );
}
