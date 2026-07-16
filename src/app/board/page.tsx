import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth/actions";
import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { KanbanBoard } from "@/components/board/kanban-board";
import { getCurrentMembership } from "@/lib/org/get-current-membership";

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
    { data: statuses },
    { data: tickets },
    { data: clients },
    { data: ticketTypes },
    { data: sprints },
    { data: members },
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
    supabase.from("profiles").select("id, full_name"),
  ]);

  const membersById = new Map(
    (members ?? []).map((m) => [m.id, m.full_name ?? "Sem nome"])
  );

  const canApprove = membership.role === "admin" || membership.role === "approver";
  const isAdmin = membership.role === "admin";

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[100rem] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <div>
              <p className="text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">
                {membership.organizations?.name ?? "Painel Relacional"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {user?.email}
                {membership.role ? ` · ${membership.role}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link href="/settings">
                <Button variant="secondary">
                  <Settings className="h-4 w-4" aria-hidden />
                  Configurações
                </Button>
              </Link>
            )}
            <ThemeToggle />
            <form action={logout}>
              <Button type="submit" variant="secondary">
                <LogOut className="h-4 w-4" aria-hidden />
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[100rem] flex-1 overflow-hidden">
        {statuses && statuses.length > 0 ? (
          <KanbanBoard
            boardId={board.id}
            organizationId={membership.organization_id}
            statuses={statuses}
            initialTickets={tickets ?? []}
            clients={clients ?? []}
            ticketTypes={ticketTypes ?? []}
            sprints={sprints ?? []}
            membersById={membersById}
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
