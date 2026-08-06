import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { FollowupPolicyRow } from "@/components/settings/followup-policy-row";
import type { Database } from "@/types/database.types";

type TicketUrgency = Database["public"]["Enums"]["ticket_urgency"];

// Most urgent first — matches the order admins scan a table like this in,
// same intent as URGENCY_RANK in urgency-badge.tsx (kept as a separate
// literal here since this page only needs display order, not comparison).
const URGENCY_ORDER: TicketUrgency[] = ["critical", "high", "medium", "low"];

export const dynamic = "force-dynamic";

export default async function FollowupPage() {
  const supabase = await createClient();
  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  const { data: policies } = await supabase
    .from("followup_policies")
    .select("urgency, interval_hours")
    .eq("organization_id", membership.organization_id);

  const intervalByUrgency = new Map(
    (policies ?? []).map((p) => [p.urgency, p.interval_hours])
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Cobrança de andamento
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          De quanto em quanto tempo lembrar de cobrar o andamento de um
          chamado, por urgência — não é um prazo final, é um lembrete
          recorrente (ex: chamados de urgência Alta, cobrar a cada 14 dias).
          A contagem reinicia sempre que alguém marca &ldquo;Marquei a
          cobrança&rdquo; no chamado; até lá, conta a partir da data de
          abertura.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Urgência
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Cobrar a cada
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {URGENCY_ORDER.map((urgency) => (
              <FollowupPolicyRow
                key={urgency}
                urgency={urgency}
                intervalHours={intervalByUrgency.get(urgency) ?? 168}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
