import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { SlaPolicyRow } from "@/components/settings/sla-policy-row";
import type { Database } from "@/types/database.types";

type TicketUrgency = Database["public"]["Enums"]["ticket_urgency"];

// Most urgent first — matches the order admins scan a table like this in,
// same intent as URGENCY_RANK in urgency-badge.tsx (kept as a separate
// literal here since this page only needs display order, not comparison).
const URGENCY_ORDER: TicketUrgency[] = ["critical", "high", "medium", "low"];

export const dynamic = "force-dynamic";

export default async function SlaPage() {
  const supabase = await createClient();
  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  const { data: policies } = await supabase
    .from("sla_policies")
    .select("urgency, duration_hours")
    .eq("organization_id", membership.organization_id);

  const durationByUrgency = new Map(
    (policies ?? []).map((p) => [p.urgency, p.duration_hours])
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          SLA
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Prazo de resposta por urgência. Ao criar ou reclassificar um
          chamado, o prazo é calculado automaticamente a partir da data de
          abertura + o valor definido aqui. Chamados já abertos mantêm o
          prazo calculado no momento — mudar o valor aqui não altera o prazo
          de chamados existentes, só afeta novos chamados ou reclassificações
          futuras.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Urgência
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Prazo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {URGENCY_ORDER.map((urgency) => (
              <SlaPolicyRow
                key={urgency}
                urgency={urgency}
                durationHours={durationByUrgency.get(urgency) ?? 24}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
