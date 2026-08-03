import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { KanbanBoard } from "@/components/board/kanban-board";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { parseBoardFilters } from "@/lib/board/layout-preferences";

// This page renders per-user data (membership role, org, tickets) fetched
// via Supabase REST calls. Next.js's fetch cache can otherwise serve one
// user's cached response to a different user's request on the same route
// — force fully dynamic, uncached rendering.
export const dynamic = "force-dynamic";

export default async function BoardPage() {
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
    { data: statuses, error: statusesError },
    { data: tickets, error: ticketsError },
    { data: clients },
    { data: ticketTypes },
    { data: sprints },
    { data: orgMemberships },
    { data: developers },
    { data: layoutPreferences },
  ] = await Promise.all([
    supabase
      .from("statuses")
      .select("*")
      .eq("board_id", board.id)
      .order("order", { ascending: true }),
    supabase.from("tickets").select("*").eq("board_id", board.id),
    supabase
      .from("clients")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("name"),
    supabase
      .from("ticket_types")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("name"),
    supabase.from("sprints").select("*").eq("board_id", board.id).order("start_date"),
    // Scoped by organization_id first (rather than fetching every profile
    // RLS happens to let this user see) so the query's own filter — not
    // just RLS — expresses "this org's members".
    supabase
      .from("memberships")
      .select("user_id")
      .eq("organization_id", membership.organization_id),
    supabase
      .from("developers")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .order("name"),
    supabase
      .from("layout_preferences")
      .select("layout_json")
      .eq("board_id", board.id)
      .eq("user_id", user?.id ?? "")
      .maybeSingle(),
  ]);

  const orgMemberUserIds = (orgMemberships ?? []).map((m) => m.user_id);
  const { data: members } =
    orgMemberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", orgMemberUserIds)
      : { data: [] };

  const membersById = new Map(
    (members ?? []).map((m) => [m.id, m.full_name ?? "Sem nome"])
  );

  const initialFilters = parseBoardFilters(layoutPreferences?.layout_json);

  const canApprove = membership.role === "admin" || membership.role === "approver";
  const isAdmin = membership.role === "admin";

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <AppHeader
        orgName={membership.organizations?.name ?? "Painel Relacional"}
        userEmail={user?.email}
        role={membership.role}
        isAdmin={isAdmin}
        active="board"
      />

      <div className="mx-auto flex w-full max-w-[100rem] flex-1 overflow-hidden">
        {statusesError || ticketsError ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">
              Não foi possível carregar o quadro. Tente recarregar a página.
            </p>
          </div>
        ) : statuses && statuses.length > 0 ? (
          <KanbanBoard
            boardId={board.id}
            organizationId={membership.organization_id}
            statuses={statuses}
            initialTickets={tickets ?? []}
            clients={clients ?? []}
            ticketTypes={ticketTypes ?? []}
            sprints={sprints ?? []}
            membersById={membersById}
            developers={developers ?? []}
            currentUserId={user?.id ?? ""}
            initialFilters={initialFilters}
            canApprove={canApprove}
            isAdmin={isAdmin}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Este quadro ainda não tem colunas configuradas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
