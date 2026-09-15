"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { FilterChip } from "@/components/board/filter-chip";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { URGENCY_LABELS } from "@/components/board/urgency-badge";
import {
  computeDashboardStats,
  URGENCY_ORDER,
  type DashboardTicket,
} from "@/lib/dashboard/compute-stats";

type StatusLite = {
  id: string;
  name: string;
  is_terminal: boolean;
  is_denied: boolean;
  is_awaiting_approval: boolean;
};

type NamedEntity = { id: string; name: string };

type HistoryEntry = {
  ticket_id: string;
  to_status_id: string | null;
  moved_at: string;
};

export function DashboardView({
  tickets,
  statuses,
  sprints,
  developers,
  clients,
  ticketTypes,
  members,
  history,
}: {
  tickets: DashboardTicket[];
  statuses: StatusLite[];
  sprints: NamedEntity[];
  developers: NamedEntity[];
  clients: NamedEntity[];
  ticketTypes: NamedEntity[];
  members: NamedEntity[];
  history: HistoryEntry[];
}) {
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [developerFilter, setDeveloperFilter] = useState<string[]>([]);
  const [sprintFilter, setSprintFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [urgencyFilter, setUrgencyFilter] = useState<string[]>([]);

  const filteredTickets = useMemo(() => {
    let result = tickets;

    if (typeFilter.length > 0) {
      result = result.filter((t) => typeFilter.includes(t.type_id ?? "none"));
    }
    if (clientFilter.length > 0) {
      result = result.filter((t) =>
        clientFilter.includes(t.client_id ?? "none")
      );
    }
    if (developerFilter.length > 0) {
      result = result.filter((t) =>
        developerFilter.includes(t.developer_id ?? "none")
      );
    }
    if (sprintFilter.length > 0) {
      result = result.filter((t) =>
        sprintFilter.includes(t.sprint_id ?? "none")
      );
    }
    if (statusFilter.length > 0) {
      result = result.filter((t) => statusFilter.includes(t.status_id));
    }
    if (urgencyFilter.length > 0) {
      result = result.filter((t) => urgencyFilter.includes(t.urgency));
    }

    return result;
  }, [
    tickets,
    typeFilter,
    clientFilter,
    developerFilter,
    sprintFilter,
    statusFilter,
    urgencyFilter,
  ]);

  const stats = useMemo(
    () =>
      computeDashboardStats({
        tickets: filteredTickets,
        statuses,
        sprints,
        developers,
        clients,
        members,
        history,
      }),
    [filteredTickets, statuses, sprints, developers, clients, members, history]
  );

  const hasActiveFilters =
    typeFilter.length > 0 ||
    clientFilter.length > 0 ||
    developerFilter.length > 0 ||
    sprintFilter.length > 0 ||
    statusFilter.length > 0 ||
    urgencyFilter.length > 0;

  function handleClearFilters() {
    setTypeFilter([]);
    setClientFilter([]);
    setDeveloperFilter([]);
    setSprintFilter([]);
    setStatusFilter([]);
    setUrgencyFilter([]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {ticketTypes.length > 0 && (
          <FilterChip
            label="Tipo"
            options={ticketTypes.map((t) => ({ value: t.id, label: t.name }))}
            selected={typeFilter}
            onApply={setTypeFilter}
          />
        )}

        {clients.length > 0 && (
          <FilterChip
            label="Cliente"
            options={[
              { value: "none", label: "Sem cliente" },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
            selected={clientFilter}
            onApply={setClientFilter}
          />
        )}

        {developers.length > 0 && (
          <FilterChip
            label="Desenvolvedor"
            options={[
              { value: "none", label: "Sem desenvolvedor" },
              ...developers.map((d) => ({ value: d.id, label: d.name })),
            ]}
            selected={developerFilter}
            onApply={setDeveloperFilter}
          />
        )}

        {sprints.length > 0 && (
          <FilterChip
            label="Sprint"
            options={[
              { value: "none", label: "Sem sprint" },
              ...sprints.map((s) => ({ value: s.id, label: s.name })),
            ]}
            selected={sprintFilter}
            onApply={setSprintFilter}
          />
        )}

        <FilterChip
          label="Status"
          options={statuses.map((s) => ({ value: s.id, label: s.name }))}
          selected={statusFilter}
          onApply={setStatusFilter}
        />

        <FilterChip
          label="Urgência"
          options={URGENCY_ORDER.map((u) => ({
            value: u,
            label: URGENCY_LABELS[u],
          }))}
          selected={urgencyFilter}
          onApply={setUrgencyFilter}
        />

        <button
          type="button"
          onClick={handleClearFilters}
          disabled={!hasActiveFilters}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
            hasActiveFilters
              ? "text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
              : "cursor-not-allowed text-slate-300 dark:text-slate-700"
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Limpar filtros
        </button>
      </div>

      <DashboardCharts {...stats} />
    </div>
  );
}
