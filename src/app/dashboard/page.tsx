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

  const [{ data: statuses }, { data: tickets }, { data: sprints }] =
    await Promise.all([
      supabase
        .from("statuses")
        .select("id, name")
        .eq("board_id", board.id)
        .order("order", { ascending: true }),
      supabase
        .from("tickets")
        .select("id, status_id, urgency, approved, deadline, sprint_id, developer_id")
        .eq("board_id", board.id),
      supabase
        .from("sprints")
        .select("id, name")
        .eq("board_id", board.id)
        .order("start_date", { ascending: true }),
    ]);

  const safeTickets = tickets ?? [];
  const safeStatuses = statuses ?? [];
  const safeSprints = sprints ?? [];

  const today = new Date().toISOString().slice(0, 10);

  const totalTickets = safeTickets.length;
  const pendingApproval = safeTickets.filter((t) => !t.approved).length;
  const overdue = safeTickets.filter(
    (t) => t.deadline !== null && t.deadline < today
  ).length;
  const unassigned = safeTickets.filter((t) => !t.developer_id).length;

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
          unassigned={unassigned}
          byStatus={byStatus}
          byUrgency={byUrgency}
          bySprint={bySprint}
        />
      </main>
    </div>
  );
}
