"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { Search, X, AlertTriangle, CalendarClock, CheckCircle2, TicketIcon } from "lucide-react";
import { FilterChip } from "@/components/board/filter-chip";
import { Input } from "@/components/ui/input";
import type { CurrentSprint, PdvnetWorkItem } from "@/lib/pdvnet/client-panel";

function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: typeof TicketIcon;
  tone?: "default" | "critical";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Icon
          className={clsx("h-4 w-4", tone === "critical" && "text-red-500")}
          aria-hidden
        />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function StateBadge({ state, isOpen }: { state: string; isOpen: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        isOpen
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      )}
    >
      {state}
    </span>
  );
}

// "Sprint 40" -> 40, for numeric sort; non-matching labels sort last.
function sprintNumber(label: string) {
  const match = label.match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function WorkItemRow({
  item,
  currentSprintPath,
}: {
  item: PdvnetWorkItem;
  currentSprintPath: string | null;
}) {
  const isCurrentSprint = currentSprintPath !== null && item.iterationPath === currentSprintPath;

  return (
    <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        {item.chamado ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
        <div className="max-w-md truncate" title={item.title}>
          {item.title}
        </div>
        {item.sistema && (
          <div className="text-xs text-slate-400 dark:text-slate-500">{item.sistema}</div>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        {item.cliente ?? <span className="text-slate-400 dark:text-slate-500">Sem cliente</span>}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <StateBadge state={item.state} isOpen={item.isOpen} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        {item.sprintLabel ? (
          <span
            className={clsx(
              isCurrentSprint && "font-semibold text-indigo-600 dark:text-indigo-400"
            )}
          >
            {item.sprintLabel}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">Sem sprint</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        {item.devOwner ?? item.assignedTo ?? (
          <span className="text-slate-400 dark:text-slate-500">Sem responsável</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <span
          className={clsx(
            item.isOverdue
              ? "font-medium text-red-600 dark:text-red-400"
              : "text-slate-600 dark:text-slate-300"
          )}
        >
          {formatDate(item.targetDate)}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        {formatDate(item.changedDate)}
      </td>
    </tr>
  );
}

export function PdvnetStatusPanel({
  items,
  currentSprint,
}: {
  items: PdvnetWorkItem[];
  currentSprint: CurrentSprint;
}) {
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [sprintFilter, setSprintFilter] = useState<string[]>([]);
  const [chamadoQuery, setChamadoQuery] = useState("");

  const clienteOptions = useMemo(() => {
    const values = new Set<string>();
    let hasNoClient = false;
    for (const item of items) {
      if (item.cliente) values.add(item.cliente);
      else hasNoClient = true;
    }
    const sorted = Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return hasNoClient ? [...sorted, "Sem cliente"] : sorted;
  }, [items]);

  const sprintOptions = useMemo(() => {
    const values = new Set<string>();
    let hasNoSprint = false;
    for (const item of items) {
      if (item.sprintLabel) values.add(item.sprintLabel);
      else hasNoSprint = true;
    }
    const sorted = Array.from(values).sort((a, b) => sprintNumber(b) - sprintNumber(a));
    return hasNoSprint ? [...sorted, "Sem sprint"] : sorted;
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;

    if (clienteFilter.length > 0) {
      result = result.filter((item) =>
        clienteFilter.includes(item.cliente ?? "Sem cliente")
      );
    }

    if (sprintFilter.length > 0) {
      result = result.filter((item) =>
        sprintFilter.includes(item.sprintLabel ?? "Sem sprint")
      );
    }

    const query = chamadoQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (item) =>
          String(item.chamado ?? "").includes(query) ||
          item.title.toLowerCase().includes(query) ||
          (item.cliente ?? "").toLowerCase().includes(query)
      );
    }

    return result;
  }, [items, clienteFilter, sprintFilter, chamadoQuery]);

  const open = filteredItems.filter((i) => i.isOpen);
  const closed = filteredItems.filter((i) => !i.isOpen);
  const inCurrentSprintCount = currentSprint
    ? open.filter((i) => i.iterationPath === currentSprint.path).length
    : 0;
  const overdueCount = open.filter((i) => i.isOverdue).length;

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

  const hasActiveFilters =
    clienteFilter.length > 0 || sprintFilter.length > 0 || chamadoQuery.trim() !== "";

  function handleClearFilters() {
    setClienteFilter([]);
    setSprintFilter([]);
    setChamadoQuery("");
  }

  return (
    <div className="space-y-6">
      {currentSprint && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
          Sprint atual: <span className="font-semibold">{currentSprint.name}</span>
          {currentSprint.startDate && currentSprint.finishDate && (
            <>
              {" "}
              ({formatDate(currentSprint.startDate)} – {formatDate(currentSprint.finishDate)})
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={chamadoQuery}
            onChange={(e) => setChamadoQuery(e.target.value)}
            placeholder="Buscar por nº do chamado, título ou cliente"
            className="w-72 pl-9"
            aria-label="Buscar chamado"
          />
        </div>

        {clienteOptions.length > 0 && (
          <FilterChip
            label="Cliente"
            options={clienteOptions.map((c) => ({ value: c, label: c }))}
            selected={clienteFilter}
            onApply={setClienteFilter}
          />
        )}

        {sprintOptions.length > 0 && (
          <FilterChip
            label="Sprint"
            options={sprintOptions.map((s) => ({ value: s, label: s }))}
            selected={sprintFilter}
            onApply={setSprintFilter}
          />
        )}

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total de chamados" value={filteredItems.length} icon={TicketIcon} />
        <StatTile label="Em aberto" value={open.length} icon={CheckCircle2} />
        <StatTile label="No sprint atual" value={inCurrentSprintCount} icon={CalendarClock} />
        <StatTile
          label="Atrasados"
          value={overdueCount}
          icon={AlertTriangle}
          tone={overdueCount > 0 ? "critical" : "default"}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Em aberto ({sortedOpen.length})
          </h2>
        </div>
        {sortedOpen.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500">
            Nenhum chamado em aberto para esse filtro.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Chamado
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Título
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cliente
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Estado
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Sprint
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Responsável
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Prazo
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Atualizado em
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedOpen.map((item) => (
                  <WorkItemRow
                    key={item.id}
                    item={item}
                    currentSprintPath={currentSprint?.path ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Concluídos recentemente
          </h2>
        </div>
        {recentlyClosed.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500">
            Nenhum chamado concluído para esse filtro.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Chamado
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Título
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cliente
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Estado
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Responsável
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Concluído em
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentlyClosed.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {item.chamado ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      <div className="max-w-md truncate" title={item.title}>
                        {item.title}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {item.cliente ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StateBadge state={item.state} isOpen={item.isOpen} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {item.devOwner ?? item.assignedTo ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(item.closedDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
