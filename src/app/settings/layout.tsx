import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Tag,
  CalendarRange,
  Code2,
  ListChecks,
  Bell,
  ArrowLeft,
} from "lucide-react";
import { getCurrentMembership } from "@/lib/org/get-current-membership";

// Per-user data (admin gate, org membership) — never let Next.js's fetch
// cache serve one user's response to another's request on this route.
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/settings/members", label: "Membros", icon: UserPlus },
  { href: "/settings/clients", label: "Clientes", icon: Users },
  { href: "/settings/ticket-types", label: "Tipos de chamado", icon: Tag },
  { href: "/settings/developers", label: "Desenvolvedores", icon: Code2 },
  { href: "/settings/sprints", label: "Sprints", icon: CalendarRange },
  { href: "/settings/statuses", label: "Status", icon: ListChecks },
  { href: "/settings/followup", label: "Cobrança", icon: Bell },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentMembership();

  if (!membership || membership.role !== "admin") {
    redirect("/board");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-10">
        <aside className="w-56 shrink-0">
          <Link
            href="/board"
            className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar ao quadro
          </Link>

          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Configurações
          </p>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
