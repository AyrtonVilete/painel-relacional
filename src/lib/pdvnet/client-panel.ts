import "server-only";
import { adoConfig } from "@/lib/pdvnet/sync";
import { PDVNET_CLOSED_STATES } from "@/lib/pdvnet/constants";

// Live, read-only view for a single client's current work — unlike
// pdvnet_tickets (synced once daily by cron, for the broad analytics
// dashboard), this queries Azure DevOps directly on every page load so
// "what are we on right now" is always fresh. Never issues anything but a
// GET or a read-only WIQL/batch query — no write endpoint is ever called.
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

export type ClientWorkItem = {
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

async function fetchClientWorkItems(clienteQuery: string): Promise<ClientWorkItem[]> {
  const { org, project, authHeader } = adoConfig();
  const escaped = clienteQuery.replace(/'/g, "''");
  const query = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [Custom.Cliente] CONTAINS '${escaped}' ORDER BY [System.ChangedDate] DESC`;

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

  const items: AdoFields[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
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
    items.push(...batchData.value.map((v) => v.fields));
  }

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
      sistema: f["Custom.Sistema"] ?? null,
      targetDate,
      changedDate: f["System.ChangedDate"] ?? null,
      createdDate: f["System.CreatedDate"] ?? null,
      closedDate: f["Microsoft.VSTS.Common.ClosedDate"] ?? null,
      isOverdue: isOpen && targetDate !== null && targetDate.slice(0, 10) < today,
    };
  });
}

export async function getClientPanelData(clienteQuery: string) {
  const [currentSprint, items] = await Promise.all([
    fetchCurrentIteration(),
    fetchClientWorkItems(clienteQuery),
  ]);

  const open = items.filter((i) => i.isOpen);
  const closed = items.filter((i) => !i.isOpen);
  const inCurrentSprint = currentSprint
    ? open.filter((i) => i.iterationPath === currentSprint.path)
    : [];
  const overdue = open.filter((i) => i.isOverdue);

  // Current-sprint work first, then whatever's most urgent (earliest
  // deadline) — items with no prazo defined sort last within their group.
  const sortedOpen = [...open].sort((a, b) => {
    const aInSprint = currentSprint && a.iterationPath === currentSprint.path ? 0 : 1;
    const bInSprint = currentSprint && b.iterationPath === currentSprint.path ? 0 : 1;
    if (aInSprint !== bInSprint) return aInSprint - bInSprint;
    if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return (b.changedDate ?? "").localeCompare(a.changedDate ?? "");
  });

  const recentlyClosed = [...closed]
    .sort((a, b) => (b.closedDate ?? "").localeCompare(a.closedDate ?? ""))
    .slice(0, 10);

  return {
    currentSprint,
    total: items.length,
    totalOpen: open.length,
    totalClosed: closed.length,
    inCurrentSprintCount: inCurrentSprint.length,
    overdueCount: overdue.length,
    openItems: sortedOpen,
    recentlyClosed,
    fetchedAt: new Date().toISOString(),
  };
}

export type ClientPanelData = Awaited<ReturnType<typeof getClientPanelData>>;
