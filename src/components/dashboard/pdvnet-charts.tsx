"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Clock, FolderOpen, Users, type LucideIcon } from "lucide-react";
import type { computePdvnetStats } from "@/lib/pdvnet/compute-stats";

const BRAND_COLOR = "#6366f1";
const AXIS_COLOR = "#94a3b8";
const OPEN_COLOR = "#f59e0b";
const CLOSED_COLOR = "#22c55e";

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

function formatResolutionDays(days: number) {
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(1)}d`;
}

function formatSyncedAt(iso: string | null) {
  if (!iso) return "nunca sincronizado";
  return new Date(iso).toLocaleString("pt-BR");
}

export function PdvnetCharts({
  stats,
}: {
  stats: ReturnType<typeof computePdvnetStats>;
}) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Última sincronização com o Azure DevOps: {formatSyncedAt(stats.lastSyncedAt)}
      </p>

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
          {stats.byClient.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum chamado em aberto.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, stats.byClient.length * 32)}>
              <BarChart data={stats.byClient} layout="vertical" margin={{ left: 24 }}>
                <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={12} />
                <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} fontSize={12} width={140} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill={BRAND_COLOR} radius={[0, 4, 4, 0]} name="Abertos" />
              </BarChart>
            </ResponsiveContainer>
          )}
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
          {stats.byDevOwner.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum chamado em aberto.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, stats.byDevOwner.length * 32)}>
              <BarChart data={stats.byDevOwner} layout="vertical" margin={{ left: 24 }}>
                <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={12} />
                <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} fontSize={12} width={140} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill={BRAND_COLOR} radius={[0, 4, 4, 0]} name="Abertos" />
              </BarChart>
            </ResponsiveContainer>
          )}
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
      </div>
    </div>
  );
}
