import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { NEXUS_ORG_ID, PDVNET_CUSTOMER_TAGS } from "@/lib/pdvnet/constants";
import type { TablesInsert } from "@/types/database.types";

const FIELDS = [
  "System.Id",
  "System.Title",
  "System.WorkItemType",
  "System.State",
  "System.Tags",
  "System.AssignedTo",
  "System.CreatedDate",
  "System.ChangedDate",
  "Microsoft.VSTS.Common.ClosedDate",
  "Microsoft.VSTS.Common.Priority",
  "Custom.Cliente",
  "Custom.Chamado",
  "Custom.Sistema",
  "Custom.DevOwner",
  "Custom.QAOwner",
  "Custom.ApprovedDate",
  "Custom.CommitedDate",
  "Custom.QADate",
] as const;

type AdoIdentity = { displayName?: string } | null | undefined;

type AdoFields = {
  "System.Id": number;
  "System.Title": string;
  "System.WorkItemType": string;
  "System.State": string;
  "System.Tags"?: string;
  "System.AssignedTo"?: AdoIdentity;
  "System.CreatedDate"?: string;
  "System.ChangedDate"?: string;
  "Microsoft.VSTS.Common.ClosedDate"?: string;
  "Microsoft.VSTS.Common.Priority"?: number;
  "Custom.Cliente"?: string;
  "Custom.Chamado"?: number;
  "Custom.Sistema"?: string;
  "Custom.DevOwner"?: AdoIdentity;
  "Custom.QAOwner"?: AdoIdentity;
  "Custom.ApprovedDate"?: string;
  "Custom.CommitedDate"?: string;
  "Custom.QADate"?: string;
};

function adoConfig() {
  const org = process.env.AZURE_DEVOPS_ORG;
  const project = process.env.AZURE_DEVOPS_PROJECT;
  const pat = process.env.AZURE_DEVOPS_PAT;
  if (!org || !project || !pat) {
    throw new Error("Azure DevOps env vars not configured");
  }
  const authHeader = `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
  return { org, project, authHeader };
}

async function fetchIds(): Promise<number[]> {
  const { org, project, authHeader } = adoConfig();

  const tagClause = PDVNET_CUSTOMER_TAGS.map(
    (tag) => `[System.Tags] CONTAINS '${tag}'`
  ).join(" OR ");
  // Also pulls in anything with Custom.Chamado filled in, tagged or not —
  // that's the field ticket-to-DevOps cross-referencing keys off
  // (linkAdoDataToTickets), so a freshly-escalated item with no business
  // tag yet still needs to be in this table for that to find it.
  const query = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND ((${tagClause}) OR [Custom.Chamado] <> '') ORDER BY [System.ChangedDate] DESC`;

  const res = await fetch(
    `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.1`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ query }),
    }
  );

  if (!res.ok) {
    throw new Error(`WIQL query failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { workItems: { id: number }[] };
  return data.workItems.map((w) => w.id);
}

async function fetchBatch(ids: number[]): Promise<AdoFields[]> {
  const { org, project, authHeader } = adoConfig();

  const res = await fetch(
    `https://dev.azure.com/${org}/${project}/_apis/wit/workitemsbatch?api-version=7.1`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ ids, fields: FIELDS }),
    }
  );

  if (!res.ok) {
    throw new Error(`Batch fetch failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { value: { fields: AdoFields }[] };
  return data.value.map((v) => v.fields);
}

function toRow(fields: AdoFields): TablesInsert<"pdvnet_tickets"> {
  const tags = (fields["System.Tags"] ?? "")
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    organization_id: NEXUS_ORG_ID,
    ado_id: fields["System.Id"],
    work_item_type: fields["System.WorkItemType"],
    state: fields["System.State"],
    title: fields["System.Title"],
    tags,
    cliente: fields["Custom.Cliente"] ?? null,
    chamado: fields["Custom.Chamado"] ?? null,
    sistema: fields["Custom.Sistema"] ?? null,
    dev_owner: fields["Custom.DevOwner"]?.displayName ?? null,
    qa_owner: fields["Custom.QAOwner"]?.displayName ?? null,
    assigned_to: fields["System.AssignedTo"]?.displayName ?? null,
    priority: fields["Microsoft.VSTS.Common.Priority"] ?? null,
    created_date: fields["System.CreatedDate"] ?? null,
    changed_date: fields["System.ChangedDate"] ?? null,
    closed_date: fields["Microsoft.VSTS.Common.ClosedDate"] ?? null,
    approved_date: fields["Custom.ApprovedDate"] ?? null,
    committed_date: fields["Custom.CommitedDate"] ?? null,
    qa_date: fields["Custom.QADate"] ?? null,
    synced_at: new Date().toISOString(),
  };
}

export async function syncPdvnetTickets(): Promise<{ synced: number }> {
  const ids = await fetchIds();

  const rows: TablesInsert<"pdvnet_tickets">[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const fields = await fetchBatch(chunk);
    rows.push(...fields.map(toRow));
  }

  const supabase = createAdminClient();

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("pdvnet_tickets")
      .upsert(chunk, { onConflict: "organization_id,ado_id" });
    if (error) {
      throw new Error(`Upsert failed: ${error.message}`);
    }
  }

  return { synced: rows.length };
}

// Cross-references our own tickets against what's now in pdvnet_tickets by
// ticket_number == Custom.Chamado — the same "chamado" number the
// relationship team already uses is what gets embedded in Azure DevOps'
// Custom.Chamado field once an item is escalated there. When DevOps has a
// developer (Custom.DevOwner) and a committed date (Custom.CommitedDate)
// for a matching chamado, that fills in our ticket's developer_id/
// execution_deadline — but only fields that are still empty on our side,
// so a manual edit already made in Painel Relacional is never overwritten.
export async function linkAdoDataToTickets(): Promise<{
  linkedTickets: number;
  developersCreated: number;
}> {
  const supabase = createAdminClient();

  const [{ data: tickets, error: ticketsError }, { data: adoTickets, error: adoError }] =
    await Promise.all([
      supabase
        .from("tickets")
        .select("id, ticket_number, developer_id, execution_deadline")
        .eq("organization_id", NEXUS_ORG_ID),
      supabase
        .from("pdvnet_tickets")
        .select("chamado, dev_owner, committed_date")
        .eq("organization_id", NEXUS_ORG_ID)
        .not("chamado", "is", null)
        .not("dev_owner", "is", null)
        .not("committed_date", "is", null),
    ]);

  if (ticketsError) throw new Error(`Fetching tickets failed: ${ticketsError.message}`);
  if (adoError) throw new Error(`Fetching pdvnet_tickets failed: ${adoError.message}`);

  const adoByChamado = new Map<number, { devOwner: string; committedDate: string }>();
  for (const t of adoTickets ?? []) {
    if (t.chamado === null || !t.dev_owner || !t.committed_date) continue;
    adoByChamado.set(t.chamado, { devOwner: t.dev_owner, committedDate: t.committed_date });
  }

  const candidates = (tickets ?? []).filter((t) => {
    const match = adoByChamado.get(t.ticket_number);
    if (!match) return false;
    return t.developer_id === null || t.execution_deadline === null;
  });

  if (candidates.length === 0) {
    return { linkedTickets: 0, developersCreated: 0 };
  }

  const { data: existingDevelopers, error: developersError } = await supabase
    .from("developers")
    .select("id, name")
    .eq("organization_id", NEXUS_ORG_ID);
  if (developersError) {
    throw new Error(`Fetching developers failed: ${developersError.message}`);
  }

  const developerIdByName = new Map(
    (existingDevelopers ?? []).map((d) => [d.name.trim().toLowerCase(), d.id])
  );

  let developersCreated = 0;
  let linkedTickets = 0;

  for (const ticket of candidates) {
    const match = adoByChamado.get(ticket.ticket_number);
    if (!match) continue;

    const update: { developer_id?: string; execution_deadline?: string } = {};

    if (ticket.developer_id === null) {
      const key = match.devOwner.trim().toLowerCase();
      let developerId = developerIdByName.get(key);
      if (!developerId) {
        const { data: newDeveloper, error: insertError } = await supabase
          .from("developers")
          .insert({ organization_id: NEXUS_ORG_ID, name: match.devOwner.trim() })
          .select("id")
          .single();
        if (insertError || !newDeveloper) {
          throw new Error(`Creating developer failed: ${insertError?.message}`);
        }
        developerId = newDeveloper.id;
        developerIdByName.set(key, developerId);
        developersCreated += 1;
      }
      update.developer_id = developerId;
    }

    if (ticket.execution_deadline === null) {
      update.execution_deadline = match.committedDate.slice(0, 10);
    }

    const { error: updateError } = await supabase
      .from("tickets")
      .update(update)
      .eq("id", ticket.id);
    if (updateError) {
      throw new Error(`Updating ticket ${ticket.id} failed: ${updateError.message}`);
    }
    linkedTickets += 1;
  }

  return { linkedTickets, developersCreated };
}
