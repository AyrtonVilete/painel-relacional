import { clsx } from "clsx";
import { AlertTriangle, CalendarClock, CheckCircle2, TicketIcon } from "lucide-react";
import type { ClientPanelData, ClientWorkItem } from "@/lib/pdvnet/client-panel";

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

function WorkItemRow({
  item,
  currentSprintPath,
}: {
  item: ClientWorkItem;
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

export function ClientPanel({ data }: { data: ClientPanelData }) {
  return (
    <div className="space-y-6">
      {data.currentSprint && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
          Sprint atual:{" "}
          <span className="font-semibold">{data.currentSprint.name}</span>
          {data.currentSprint.startDate && data.currentSprint.finishDate && (
            <>
              {" "}
              ({formatDate(data.currentSprint.startDate)} –{" "}
              {formatDate(data.currentSprint.finishDate)})
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total de chamados" value={data.total} icon={TicketIcon} />
        <StatTile label="Em aberto" value={data.totalOpen} icon={CheckCircle2} />
        <StatTile
          label="No sprint atual"
          value={data.inCurrentSprintCount}
          icon={CalendarClock}
        />
        <StatTile
          label="Atrasados"
          value={data.overdueCount}
          icon={AlertTriangle}
          tone={data.overdueCount > 0 ? "critical" : "default"}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Em aberto ({data.openItems.length})
          </h2>
        </div>
        {data.openItems.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500">
            Nenhum chamado em aberto para esse cliente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Chamado
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Título
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
                {data.openItems.map((item) => (
                  <WorkItemRow
                    key={item.id}
                    item={item}
                    currentSprintPath={data.currentSprint?.path ?? null}
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
        {data.recentlyClosed.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500">
            Nenhum chamado concluído ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Chamado
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Título
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
                {data.recentlyClosed.map((item) => (
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
