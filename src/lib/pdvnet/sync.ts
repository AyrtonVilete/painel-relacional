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
  const query = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND (${tagClause}) ORDER BY [System.ChangedDate] DESC`;

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
