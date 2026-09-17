import "server-only";
import { adoConfig } from "@/lib/pdvnet/sync";
import { PDVNET_CLOSED_STATES, PDVNET_CUSTOMER_TAGS } from "@/lib/pdvnet/constants";

// Live, read-only view of every customer-facing chamado — unlike
// pdvnet_tickets (synced once daily by cron, for the broad analytics
// dashboard), this queries Azure DevOps directly on every page load so
// "what are we on right now" is always fresh. Never issues anything but a
// GET or a read-only WIQL/batch query — no write endpoint is ever called.
// Scope mirrors sync.ts's fetchIds exactly (tagged OR has a Custom.Chamado)
// so this shows the same "customer-facing" set as the rest of PDVNET, not
// the ~1100 QA/internal work items sharing the same Azure DevOps project.
const FIELDS = [
  "System.Id",
  "System.Title",
  "System.WorkItemType",
  "System.State",
  "System.Tags",
  "System.AssignedTo",
  "System.IterationPath",
  "System.CreatedDate",
  "System.ChangedDate",
  "Microsoft.VSTS.Scheduling.TargetDate",
  "Microsoft.VSTS.Common.ClosedDate",
  "Custom.Cliente",
  "Custom.Chamado",
  "Custom.Sistema",
  "Custom.DevOwner",
  "Custom.QAOwner",
] as const;

type AdoIdentity = { displayName?: string } | null | undefined;

type AdoFields = {
  "System.Id": number;
  "System.Title": string;
  "System.WorkItemType": string;
  "System.State": string;
  "System.Tags"?: string;
  "System.AssignedTo"?: AdoIdentity;
  "System.IterationPath"?: string;
  "System.CreatedDate"?: string;
  "System.ChangedDate"?: string;
  "Microsoft.VSTS.Scheduling.TargetDate"?: string;
  "Microsoft.VSTS.Common.ClosedDate"?: string;
  "Custom.Cliente"?: string;
  "Custom.Chamado"?: number;
  "Custom.Sistema"?: string;
  "Custom.DevOwner"?: AdoIdentity;
  "Custom.QAOwner"?: AdoIdentity;
};

export type PdvnetWorkItem = {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  isOpen: boolean;
  tags: string[];
  assignedTo: string | null;
  devOwner: string | null;
  qaOwner: string | null;
  iterationPath: string | null;
  sprintLabel: string | null;
  chamado: number | null;
  cliente: string | null;
  sistema: string | null;
  targetDate: string | null;
  changedDate: string | null;
  createdDate: string | null;
  closedDate: string | null;
  isOverdue: boolean;
};

export type CurrentSprint = {
  name: string;
  path: string;
  startDate: string | null;
  finishDate: string | null;
} | null;

async function fetchCurrentIteration(): Promise<CurrentSprint> {
  const { org, project, authHeader } = adoConfig();

  const res = await fetch(
    `https://dev.azure.com/${org}/${project}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`,
    { headers: { Authorization: authHeader } }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    value: {
      name: string;
      path: string;
      attributes?: { startDate?: string; finishDate?: string };
    }[];
  };
  const iteration = data.value?.[0];
  if (!iteration) return null;

  return {
    name: iteration.name,
    path: iteration.path,
    startDate: iteration.attributes?.startDate ?? null,
    finishDate: iteration.attributes?.finishDate ?? null,
  };
}

async function fetchCustomerFacingWorkItems(): Promise<PdvnetWorkItem[]> {
  const { org, project, authHeader } = adoConfig();

  const tagClause = PDVNET_CUSTOMER_TAGS.map(
    (tag) => `[System.Tags] CONTAINS '${tag}'`
  ).join(" OR ");
  const query = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND ((${tagClause}) OR [Custom.Chamado] <> '') ORDER BY [System.ChangedDate] DESC`;

  const wiqlRes = await fetch(
    `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.1`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ query }),
    }
  );
  if (!wiqlRes.ok) {
    throw new Error(`WIQL query failed: ${wiqlRes.status} ${await wiqlRes.text()}`);
  }

  const wiqlData = (await wiqlRes.json()) as { workItems: { id: number }[] };
  const ids = wiqlData.workItems.map((w) => w.id);
  if (ids.length === 0) return [];

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 200) {
    chunks.push(ids.slice(i, i + 200));
  }

  // Independent chunks, fetched in parallel — this scope runs to 700+ items
  // (vs. ~50 for a single client), so a sequential loop here would make the
  // page noticeably slower to load.
  const batches = await Promise.all(
    chunks.map(async (chunk) => {
      const batchRes = await fetch(
        `https://dev.azure.com/${org}/${project}/_apis/wit/workitemsbatch?api-version=7.1`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ ids: chunk, fields: FIELDS }),
        }
      );
      if (!batchRes.ok) {
        throw new Error(`Batch fetch failed: ${batchRes.status} ${await batchRes.text()}`);
      }
      const batchData = (await batchRes.json()) as { value: { fields: AdoFields }[] };
      return batchData.value.map((v) => v.fields);
    })
  );

  const items = batches.flat();
  const today = new Date().toISOString().slice(0, 10);

  return items.map((f) => {
    const state = f["System.State"];
    const isOpen = !PDVNET_CLOSED_STATES.includes(state);
    const targetDate = f["Microsoft.VSTS.Scheduling.TargetDate"] ?? null;
    const iterationPath = f["System.IterationPath"] ?? null;

    return {
      id: f["System.Id"],
      title: f["System.Title"],
      workItemType: f["System.WorkItemType"],
      state,
      isOpen,
      tags: (f["System.Tags"] ?? "")
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean),
      assignedTo: f["System.AssignedTo"]?.displayName ?? null,
      devOwner: f["Custom.DevOwner"]?.displayName ?? null,
      qaOwner: f["Custom.QAOwner"]?.displayName ?? null,
      iterationPath,
      // Last path segment only ("Sprint 40" out of "PDVNET\2026\Sprint 40")
      // — the root "PDVNET" iteration (nothing scheduled yet) maps to null.
      sprintLabel: iterationPath && iterationPath !== project
        ? iterationPath.split("\\").pop() ?? null
        : null,
      chamado: f["Custom.Chamado"] ?? null,
      cliente: f["Custom.Cliente"]?.trim() || null,
      sistema: f["Custom.Sistema"] ?? null,
      targetDate,
      changedDate: f["System.ChangedDate"] ?? null,
      createdDate: f["System.CreatedDate"] ?? null,
      closedDate: f["Microsoft.VSTS.Common.ClosedDate"] ?? null,
      isOverdue: isOpen && targetDate !== null && targetDate.slice(0, 10) < today,
    };
  });
}

export async function getPdvnetPanelData() {
  const [currentSprint, items] = await Promise.all([
    fetchCurrentIteration(),
    fetchCustomerFacingWorkItems(),
  ]);

  return {
    currentSprint,
    items,
    fetchedAt: new Date().toISOString(),
  };
}

export type PdvnetPanelData = Awaited<ReturnType<typeof getPdvnetPanelData>>;
