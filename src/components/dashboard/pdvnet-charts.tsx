"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Clock,
  Download,
  FolderOpen,
  Users,
  type LucideIcon,
} from "lucide-react";
import { FilterChip } from "@/components/board/filter-chip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PDVNET_FILTERS,
  computePdvnetStats,
  filterPdvnetTickets,
  hasActivePdvnetFilters,
  pdvnetFilterOptions,
  type PdvnetFilters,
} from "@/lib/pdvnet/compute-stats";
import { downloadCsv, pdvnetTicketsToCsv } from "@/lib/pdvnet/export-csv";
import type { Tables } from "@/types/database.types";

const BRAND_COLOR = "#6366f1";
const AXIS_COLOR = "#94a3b8";
const OPEN_COLOR = "#f59e0b";
const CLOSED_COLOR = "#22c55e";
const CREATED_COLOR = AXIS_COLOR;
const RESOLVED_COLOR = BRAND_COLOR;

// Reuses the same "bucketed status" palette family as dashboard-charts.tsx's
// EXECUTION_BUCKET_COLORS — good/warning/serious/critical, reserved for
// state, not cycled as a categorical hue.
const AGING_COLORS: Record<string, string> = {
  "0-7 dias": "#22c55e",
  "7-30 dias": "#eab308",
  "30-90 dias": "#f97316",
  "90+ dias": "#ef4444",
};

const tooltipStyle = {
  fontSize: 13,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
};

function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Icon
          className={tone === "warning" ? "h-4 w-4 text-amber-500" : "h-4 w-4"}
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {title}
      </h2>
      {children}
    </div>
  );
}

function RankedBarChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">Nenhum chamado em aberto.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={12} />
        <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} fontSize={12} width={140} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill={BRAND_COLOR} radius={[0, 4, 4, 0]} name="Abertos" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function formatResolutionDays(days: number) {
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(1)}d`;
}

function formatSyncedAt(iso: string | null) {
  if (!iso) return "nunca sincronizado";
  return new Date(iso).toLocaleString("pt-BR");
}

export function PdvnetCharts({ tickets }: { tickets: Tables<"pdvnet_tickets">[] }) {
  const [filters, setFilters] = useState<PdvnetFilters>(DEFAULT_PDVNET_FILTERS);

  const options = useMemo(() => pdvnetFilterOptions(tickets), [tickets]);
  const filtered = useMemo(() => filterPdvnetTickets(tickets, filters), [tickets, filters]);
  const stats = useMemo(() => computePdvnetStats(filtered), [filtered]);
  const filtersActive = hasActivePdvnetFilters(filters);

  function handleExportCsv() {
    const csv = pdvnetTicketsToCsv(filtered);
    downloadCsv(`pdvnet-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Última sincronização com o Azure DevOps: {formatSyncedAt(stats.lastSyncedAt)}
        </p>
        <button
          type="button"
          onClick={() => setFilters(DEFAULT_PDVNET_FILTERS)}
          disabled={!filtersActive}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-indigo-400 dark:disabled:text-slate-600"
        >
          Limpar filtros
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="Cliente"
          options={options.clientes.map((v) => ({ value: v, label: v }))}
          selected={filters.clientes}
          onApply={(clientes) => setFilters((f) => ({ ...f, clientes }))}
        />
        <FilterChip
          label="Categoria"
          options={options.tags.map((v) => ({ value: v, label: v }))}
          selected={filters.tags}
          onApply={(tags) => setFilters((f) => ({ ...f, tags }))}
        />
        <FilterChip
          label="Responsável"
          options={options.devOwners.map((v) => ({ value: v, label: v }))}
          selected={filters.devOwners}
          onApply={(devOwners) => setFilters((f) => ({ ...f, devOwners }))}
        />
        <FilterChip
          label="Tipo"
          options={options.types.map((v) => ({ value: v, label: v }))}
          selected={filters.types}
          onApply={(types) => setFilters((f) => ({ ...f, types }))}
        />
        <FilterChip
          label="Status"
          options={options.states.map((v) => ({ value: v, label: v }))}
          selected={filters.states}
          onApply={(states) => setFilters((f) => ({ ...f, states }))}
        />
        <FilterChip
          label="Sistema"
          options={options.sistemas.map((v) => ({ value: v, label: v }))}
          selected={filters.sistemas}
          onApply={(sistemas) => setFilters((f) => ({ ...f, sistemas }))}
        />
        <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          Cadastrado:
          <Input
            type="date"
            aria-label="Cadastrado a partir de"
            value={filters.createdFrom}
            onChange={(e) => setFilters((f) => ({ ...f, createdFrom: e.target.value }))}
            className="w-40"
          />
          até
          <Input
            type="date"
            aria-label="Cadastrado até"
            value={filters.createdTo}
            onChange={(e) => setFilters((f) => ({ ...f, createdTo: e.target.value }))}
            className="w-40"
          />
        </div>
        <Button type="button" variant="secondary" onClick={handleExportCsv}>
          <Download className="h-4 w-4" aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Chamados em aberto" value={stats.totalOpen} icon={FolderOpen} />
        <StatTile
          label="Fila urgente"
          value={stats.urgentQueue.length}
          icon={AlertTriangle}
          tone={stats.urgentQueue.length > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Tempo médio de atendimento"
          value={
            stats.avgResolutionDays !== null
              ? formatResolutionDays(stats.avgResolutionDays)
              : "—"
          }
          icon={Clock}
        />
        <StatTile label="Responsáveis com fila aberta" value={stats.byDevOwner.length} icon={Users} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Chamados abertos por cliente">
          <RankedBarChart data={stats.byClient} />
        </ChartCard>

        <ChartCard title="Fila por categoria (aberto x fechado)">
          {stats.byTag.length === 0 ? (
            <p className="text-sm text-slate-400">Sem dados sincronizados ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.byTag}>
                <XAxis dataKey="name" stroke={AXIS_COLOR} fontSize={12} />
                <YAxis allowDecimals={false} stroke={AXIS_COLOR} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="aberto" stackId="a" fill={OPEN_COLOR} name="Aberto" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fechado" stackId="a" fill={CLOSED_COLOR} name="Fechado" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Carga aberta por responsável">
          <RankedBarChart data={stats.byDevOwner} />
        </ChartCard>

        <ChartCard title="Fila urgente">
          {stats.urgentQueue.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum item urgente em aberto.</p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 dark:text-slate-500">
                    <th className="pb-2 pr-2 font-medium">Título</th>
                    <th className="pb-2 pr-2 font-medium">Cliente</th>
                    <th className="pb-2 pr-2 font-medium">Idade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.urgentQueue.map((item) => (
                    <tr key={item.id}>
                      <td className="max-w-[220px] truncate py-2 pr-2 text-slate-700 dark:text-slate-300">
                        {item.title}
                      </td>
                      <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                        {item.cliente ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                        {item.ageDays}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Chamados abertos por sistema">
          <RankedBarChart data={stats.bySystem} />
        </ChartCard>

        <ChartCard title="Chamados abertos por tipo">
          <RankedBarChart data={stats.byType} />
        </ChartCard>

        <ChartCard title="Idade dos chamados em aberto">
          {stats.agingBuckets.every((b) => b.value === 0) ? (
            <p className="text-sm text-slate-400">Nenhum chamado em aberto.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.agingBuckets}>
                <XAxis dataKey="name" stroke={AXIS_COLOR} fontSize={12} />
                <YAxis allowDecimals={false} stroke={AXIS_COLOR} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Chamados">
                  {stats.agingBuckets.map((bucket) => (
                    <Cell key={bucket.name} fill={AGING_COLORS[bucket.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Prioridade dos chamados em aberto">
          <RankedBarChart data={stats.byPriority} />
        </ChartCard>

        <ChartCard title="Tempo médio por etapa do funil">
          {stats.funnelStages.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nenhuma data de aprovação/commit/QA preenchida no período.
            </p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(160, stats.funnelStages.length * 40)}
            >
              <BarChart
                data={stats.funnelStages}
                layout="vertical"
                margin={{ left: 24 }}
              >
                <XAxis type="number" stroke={AXIS_COLOR} fontSize={12} unit="d" />
                <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} fontSize={12} width={140} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [formatResolutionDays(Number(value)), "Tempo médio"]}
                />
                <Bar dataKey="days" fill={BRAND_COLOR} radius={[0, 4, 4, 0]} name="Dias" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Tendência semanal (criados x fechados)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.weeklyTrend} margin={{ top: 16, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
              <YAxis type="number" allowDecimals={false} hide />
              <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="criados" name="Criados" fill={CREATED_COLOR} radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="fechados" name="Fechados" fill={RESOLVED_COLOR} radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
