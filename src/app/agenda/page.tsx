import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { AgendaCalendar } from "@/components/agenda/agenda-calendar";

// Per-user data (membership role, org, meetings, tickets) — never let
// Next.js's fetch cache serve one user's response to a different user's
// request on this route, same reasoning as /board and /dashboard.
export const dynamic = "force-dynamic";

export default async function AgendaPage() {
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
    .select("id")
    .eq("organization_id", membership.organization_id)
    .limit(1)
    .maybeSingle();

  const [{ data: meetings }, { data: tickets }, { data: statuses }, { data: orgMemberships }] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("meeting_date", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("tickets")
        .select("id, title, ticket_number, execution_deadline, status_id")
        .eq("organization_id", membership.organization_id)
        .not("execution_deadline", "is", null),
      board
        ? supabase
            .from("statuses")
            .select("id, is_terminal, is_denied")
            .eq("board_id", board.id)
        : Promise.resolve({ data: [] as { id: string; is_terminal: boolean; is_denied: boolean }[] }),
      supabase
        .from("memberships")
        .select("user_id")
        .eq("organization_id", membership.organization_id),
    ]);

  const closedStatusIds = new Set(
    (statuses ?? []).filter((s) => s.is_terminal || s.is_denied).map((s) => s.id)
  );

  const ticketDeadlines = (tickets ?? [])
    .filter((t) => t.execution_deadline && !closedStatusIds.has(t.status_id))
    .map((t) => ({
      id: t.id,
      label: `#${t.ticket_number} ${t.title}`,
      date: t.execution_deadline as string,
    }));

  const orgMemberUserIds = (orgMemberships ?? []).map((m) => m.user_id);
  const { data: memberProfiles } =
    orgMemberUserIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", orgMemberUserIds)
      : { data: [] };

  const membersById = new Map(
    (memberProfiles ?? []).map((p) => [p.id, p.full_name ?? "Sem nome"])
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <AppHeader
        orgName={membership.organizations?.name ?? "Painel Relacional"}
        userEmail={user?.email}
        role={membership.role}
        isAdmin={membership.role === "admin"}
        active="agenda"
        currentUserId={user?.id ?? ""}
        membersById={membersById}
      />

      <main className="mx-auto w-full max-w-[100rem] flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Agenda</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Reuniões do time e prazos de execução dos chamados.
          </p>
        </div>

        <AgendaCalendar
          meetings={meetings ?? []}
          ticketDeadlines={ticketDeadlines}
          currentUserId={user?.id ?? ""}
          isAdmin={membership.role === "admin"}
        />
      </main>
    </div>
  );
}
