"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  TicketIcon,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";

type CountDatum = { name: string; value: number };
type UrgencyDatum = CountDatum & { urgency: "low" | "medium" | "high" | "critical" };
type ThroughputDatum = { name: string; criados: number; resolvidos: number };

function formatResolutionDays(days: number) {
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(1)}d`;
}

// Reuses the same severity colors as <UrgencyBadge> elsewhere in the app
// so a chamado's urgency reads the same color here as on its card.
const URGENCY_COLORS: Record<UrgencyDatum["urgency"], string> = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#f59e0b",
  critical: "#ef4444",
};

const BRAND_COLOR = "#6366f1";
const AXIS_COLOR = "#94a3b8";

function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "default" | "warning" | "critical";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Icon
          className={
            tone === "critical"
              ? "h-4 w-4 text-red-500"
              : tone === "warning"
                ? "h-4 w-4 text-amber-500"
                : "h-4 w-4"
          }
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

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {title}
      </h2>
      {children}
    </div>
  );
}

const tooltipStyle = {
  fontSize: 13,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
};

export function DashboardCharts({
  totalTickets,
  pendingApproval,
  overdue,
  followupPending,
  denied,
  unassigned,
  avgResolutionDays,
  byStatus,
  byUrgency,
  bySprint,
  throughput,
  byDeveloper,
}: {
  totalTickets: number;
  pendingApproval: number;
  overdue: number;
  followupPending: number;
  denied: number;
  unassigned: number;
  avgResolutionDays: number | null;
  byStatus: CountDatum[];
  byUrgency: UrgencyDatum[];
  bySprint: CountDatum[];
  throughput: ThroughputDatum[];
  byDeveloper: CountDatum[];
}) {
  const statusChartHeight = Math.max(byStatus.length * 44, 120);
  const sprintChartHeight = Math.max(bySprint.length * 44, 120);
  const developerChartHeight = Math.max(byDeveloper.length * 44, 120);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-7">
        <StatTile label="Total de chamados" value={totalTickets} icon={TicketIcon} />
        <StatTile
          label="Pendentes de aprovação"
          value={pendingApproval}
          icon={CheckCircle2}
          tone="warning"
        />
        <StatTile
          label="Atrasados"
          value={overdue}
          icon={AlertTriangle}
          tone="critical"
        />
        <StatTile
          label="Cobrança pendente"
          value={followupPending}
          icon={Bell}
          tone="critical"
        />
        <StatTile label="Negados" value={denied} icon={XCircle} tone="warning" />
        <StatTile
          label="Sem desenvolvedor"
          value={unassigned}
          icon={UserX}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Clock className="h-4 w-4" aria-hidden />
            <span className="text-xs font-medium">Tempo médio de resolução</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {avgResolutionDays === null ? "—" : formatResolutionDays(avgResolutionDays)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Chamados por status">
          {byStatus.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={statusChartHeight}>
              <BarChart
                data={byStatus}
                layout="vertical"
                margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
              >
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12, fill: AXIS_COLOR }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="value" fill={BRAND_COLOR} radius={[0, 4, 4, 0]} maxBarSize={24}>
                  <LabelList
                    dataKey="value"
                    position="right"
                    style={{ fill: AXIS_COLOR, fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Chamados por urgência">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byUrgency} margin={{ top: 16, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: AXIS_COLOR }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis type="number" allowDecimals={false} hide />
              <Tooltip
                cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {byUrgency.map((entry) => (
                  <Cell key={entry.urgency} fill={URGENCY_COLORS[entry.urgency]} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  style={{ fill: AXIS_COLOR, fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Chamados por sprint">
          {bySprint.every((d) => d.value === 0) ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={sprintChartHeight}>
              <BarChart
                data={bySprint}
                layout="vertical"
                margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
              >
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12, fill: AXIS_COLOR }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="value" fill={BRAND_COLOR} radius={[0, 4, 4, 0]} maxBarSize={24}>
                  <LabelList
                    dataKey="value"
                    position="right"
                    style={{ fill: AXIS_COLOR, fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Carga por desenvolvedor (chamados em aberto)">
          {byDeveloper.every((d) => d.value === 0) ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={developerChartHeight}>
              <BarChart
                data={byDeveloper}
                layout="vertical"
                margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
              >
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12, fill: AXIS_COLOR }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="value" fill={BRAND_COLOR} radius={[0, 4, 4, 0]} maxBarSize={24}>
                  <LabelList
                    dataKey="value"
                    position="right"
                    style={{ fill: AXIS_COLOR, fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Throughput semanal (criados vs. resolvidos)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={throughput} margin={{ top: 16, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: AXIS_COLOR }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis type="number" allowDecimals={false} hide />
              <Tooltip
                cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="criados"
                name="Criados"
                fill={AXIS_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
              />
              <Bar
                dataKey="resolvidos"
                name="Resolvidos"
                fill={BRAND_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
