import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { StatusTerminalToggle } from "@/components/settings/status-terminal-toggle";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function StatusesPage() {
  const supabase = await createClient();
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

  const { data: statuses } = board
    ? await supabase
        .from("statuses")
        .select("id, name, is_terminal")
        .eq("board_id", board.id)
        .order("order", { ascending: true })
    : { data: [] };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Status
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Marque quais colunas do quadro representam um chamado concluído —
          usado para calcular tempo de resolução e throughput no dashboard.
        </p>
      </div>

      {statuses && statuses.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {statuses.map((status) => (
                <tr key={status.id}>
                  <td className="px-5 py-3 text-slate-800 dark:text-slate-200">
                    {status.name}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <StatusTerminalToggle
                      statusId={status.id}
                      defaultChecked={status.is_terminal}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={ListChecks} label="Nenhum status cadastrado ainda" />
      )}
    </div>
  );
}
