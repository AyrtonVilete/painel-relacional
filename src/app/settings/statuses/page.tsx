import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { createStatus } from "@/lib/statuses/actions";
import { StatusRow } from "@/components/settings/status-row";
import { SimpleNameForm } from "@/components/settings/simple-name-form";
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
        .select("id, name, is_terminal, is_denied, is_awaiting_approval, is_approved")
        .eq("board_id", board.id)
        .order("order", { ascending: true })
    : { data: [] };

  const safeStatuses = statuses ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Status
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          As colunas do quadro — crie, renomeie, reordene ou exclua conforme o
          fluxo de trabalho da sua equipe. Marque quais representam um
          chamado concluído (usado para calcular tempo de resolução e
          throughput no dashboard), marque uma coluna como &ldquo;coluna de
          negados&rdquo; para poder usar o botão &ldquo;Negar&rdquo; nos
          chamados, marque qual coluna representa &ldquo;aguardando
          aprovação&rdquo; (define se o card mostra o Prazo previsto pra
          aprovação ou a Execução prevista), e marque uma coluna como
          &ldquo;coluna de aprovados&rdquo; para que o botão
          &ldquo;Aprovar&rdquo; mova o chamado pra lá automaticamente.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <SimpleNameForm
          action={createStatus}
          placeholder="Nome do novo status"
          submitLabel="Adicionar"
        />
      </div>

      {safeStatuses.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {safeStatuses.map((status, index) => (
                <StatusRow
                  key={status.id}
                  status={status}
                  isFirst={index === 0}
                  isLast={index === safeStatuses.length - 1}
                />
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
