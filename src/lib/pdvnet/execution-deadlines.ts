import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adoConfig } from "@/lib/pdvnet/sync";
import { NEXUS_ORG_ID, PDVNET_CLOSED_STATES } from "@/lib/pdvnet/constants";

type AdoFields = {
  "System.Id": number;
  "System.State": string;
  "System.ChangedDate"?: string;
  "Custom.Chamado"?: number;
  "Microsoft.VSTS.Scheduling.TargetDate"?: string;
};

export type ExecutionDeadlineChange = {
  ticketNumber: number;
  from: string | null;
  to: string;
};

// Double-checks every still-open chamado in our Quadro against Azure DevOps
// (matched by ticket_number == Custom.Chamado) and, when the DevOps work item
// has a delivery forecast (Microsoft.VSTS.Scheduling.TargetDate), copies it
// into our "Execução prevista" (tickets.execution_deadline). DevOps is the
// source of truth when it has a date — a different date already on our side
// gets overwritten; a chamado with no date in DevOps is left untouched.
// Strictly read-only against Azure DevOps (one WIQL query + one batch fetch).
export async function syncExecutionDeadlinesFromAdo(options?: {
  dryRun?: boolean;
}): Promise<{ checked: number; matched: number; changes: ExecutionDeadlineChange[] }> {
  const supabase = createAdminClient();

  const [{ data: tickets, error: ticketsError }, { data: boards, error: boardsError }] =
    await Promise.all([
      supabase
        .from("tickets")
        .select("id, ticket_number, status_id, execution_deadline")
        .eq("organization_id", NEXUS_ORG_ID),
      supabase.from("boards").select("id").eq("organization_id", NEXUS_ORG_ID),
    ]);
  if (ticketsError) throw new Error(`Fetching tickets failed: ${ticketsError.message}`);
  if (boardsError) throw new Error(`Fetching boards failed: ${boardsError.message}`);

  const { data: statuses, error: statusesError } = await supabase
    .from("statuses")
    .select("id, is_terminal, is_denied")
    .in(
      "board_id",
      (boards ?? []).map((b) => b.id)
    );
  if (statusesError) throw new Error(`Fetching statuses failed: ${statusesError.message}`);

  // A resolved or rejected chamado has no "execução prevista" worth keeping
  // in sync, same exclusion the dashboard uses for "atrasado".
  const inactiveStatusIds = new Set(
    (statuses ?? []).filter((s) => s.is_terminal || s.is_denied).map((s) => s.id)
  );
  const openTickets = (tickets ?? []).filter((t) => !inactiveStatusIds.has(t.status_id));
  if (openTickets.length === 0) return { checked: 0, matched: 0, changes: [] };

  const { org, project, authHeader } = adoConfig();

  const numbers = openTickets.map((t) => t.ticket_number);
  const wiqlRes = await fetch(
    `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.1`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [Custom.Chamado] IN (${numbers.join(",")})`,
      }),
    }
  );
  if (!wiqlRes.ok) {
    throw new Error(`WIQL query failed: ${wiqlRes.status} ${await wiqlRes.text()}`);
  }
  const ids = ((await wiqlRes.json()) as { workItems: { id: number }[] }).workItems.map(
    (w) => w.id
  );

  const items: AdoFields[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batchRes = await fetch(
      `https://dev.azure.com/${org}/${project}/_apis/wit/workitemsbatch?api-version=7.1`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          ids: ids.slice(i, i + 200),
          fields: [
            "System.Id",
            "System.State",
            "System.ChangedDate",
            "Custom.Chamado",
            "Microsoft.VSTS.Scheduling.TargetDate",
          ],
        }),
      }
    );
    if (!batchRes.ok) {
      throw new Error(`Batch fetch failed: ${batchRes.status} ${await batchRes.text()}`);
    }
    const batch = (await batchRes.json()) as { value: { fields: AdoFields }[] };
    items.push(...batch.value.map((v) => v.fields));
  }

  // One chamado can have several work items (e.g. a Feature plus a Bug).
  // Only open ones with a forecast count; if there are still several, the
  // most recently touched one wins.
  const targetByChamado = new Map<number, { date: string; changed: string }>();
  for (const f of items) {
    const chamado = f["Custom.Chamado"];
    const target = f["Microsoft.VSTS.Scheduling.TargetDate"];
    if (chamado === undefined || !target) continue;
    if (PDVNET_CLOSED_STATES.includes(f["System.State"])) continue;
    const changed = f["System.ChangedDate"] ?? "";
    const current = targetByChamado.get(chamado);
    if (!current || changed > current.changed) {
      // The date part of the UTC timestamp, same as linkAdoDataToTickets —
      // DevOps stores these as local midnight (e.g. "...T03:00:00Z").
      targetByChamado.set(chamado, { date: target.slice(0, 10), changed });
    }
  }

  const changes: ExecutionDeadlineChange[] = [];
  let matched = 0;
  for (const ticket of openTickets) {
    const target = targetByChamado.get(ticket.ticket_number);
    if (!target) continue;
    matched += 1;
    if (ticket.execution_deadline === target.date) continue;

    if (!options?.dryRun) {
      const { error } = await supabase
        .from("tickets")
        .update({ execution_deadline: target.date })
        .eq("id", ticket.id);
      if (error) {
        throw new Error(`Updating ticket ${ticket.ticket_number} failed: ${error.message}`);
      }
    }
    changes.push({
      ticketNumber: ticket.ticket_number,
      from: ticket.execution_deadline,
      to: target.date,
    });
  }

  return { checked: openTickets.length, matched, changes };
}
