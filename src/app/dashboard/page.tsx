import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { DashboardView } from "@/components/dashboard/dashboard-view";

// Per-user data (membership role, org, tickets) — same caching caveat as
// /board: never let Next.js's fetch cache serve one user's cached response
// to a different user's request on this route.
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

  const [
    { data: statuses },
    { data: tickets },
    { data: sprints },
    { data: developers },
    { data: clients },
    { data: ticketTypes },
    { data: orgMemberships },
  ] = await Promise.all([
    supabase
      .from("statuses")
      .select("id, name, is_terminal, is_denied, is_awaiting_approval")
      .eq("board_id", board.id)
      .order("order", { ascending: true }),
    supabase
      .from("tickets")
      .select(
        "id, status_id, urgency, approved, deadline, execution_deadline, next_followup_due, sprint_id, developer_id, client_id, type_id, created_by, created_at"
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
    supabase
      .from("clients")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .order("name"),
    supabase
      .from("ticket_types")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .order("name"),
    // Scoped by organization_id first, same reasoning as /board: express
    // "this org's members" via the query's own filter, not just RLS.
    supabase
      .from("memberships")
      .select("user_id")
      .eq("organization_id", membership.organization_id),
  ]);

  const safeTickets = tickets ?? [];
  const safeStatuses = statuses ?? [];

  const orgMemberUserIds = (orgMemberships ?? []).map((m) => m.user_id);
  const { data: memberProfiles } =
    orgMemberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", orgMemberUserIds)
      : { data: [] };

  const members = (memberProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? "Sem nome",
  }));
  const membersById = new Map(members.map((m) => [m.id, m.name]));

  const ticketIds = safeTickets.map((t) => t.id);
  const { data: history } =
    ticketIds.length > 0
      ? await supabase
          .from("ticket_history")
          .select("ticket_id, to_status_id, moved_at")
          .in("ticket_id", ticketIds)
          .order("moved_at", { ascending: true })
      : { data: [] };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <AppHeader
        orgName={membership.organizations?.name ?? "Painel Relacional"}
        orgLogoUrl={membership.organizations?.logo_url}
        organizationId={membership.organization_id}
        userEmail={user?.email}
        role={membership.role}
        isAdmin={membership.role === "admin"}
        active="dashboard"
        currentUserId={user?.id ?? ""}
        membersById={membersById}
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

        <DashboardView
          tickets={safeTickets}
          statuses={safeStatuses}
          sprints={sprints ?? []}
          developers={developers ?? []}
          clients={clients ?? []}
          ticketTypes={ticketTypes ?? []}
          members={members}
          history={history ?? []}
        />
      </main>
    </div>
  );
}
