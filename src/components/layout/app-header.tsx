import Link from "next/link";
import {
  Calendar,
  KanbanSquare,
  LayoutDashboard,
  LineChart,
  LogOut,
  Settings,
} from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { NEXUS_ORG_ID } from "@/lib/pdvnet/constants";

export function AppHeader({
  orgName,
  orgLogoUrl,
  organizationId,
  userEmail,
  role,
  isAdmin,
  active,
  currentUserId,
  membersById,
}: {
  orgName: string;
  orgLogoUrl?: string | null;
  organizationId: string;
  userEmail: string | undefined;
  role: string | null;
  isAdmin: boolean;
  active: "board" | "dashboard" | "pdvnet" | "agenda";
  currentUserId: string;
  membersById: Map<string, string>;
}) {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-2.5">
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary
            // admin-supplied URL, can't be pre-registered in next.config's
            // remotePatterns for next/image.
            <img
              src={orgLogoUrl}
              alt={orgName}
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <LogoMark />
          )}
          <div>
            <p className="text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">
              {orgName}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {userEmail}
              {role ? ` · ${role}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/board">
            <Button variant={active === "board" ? "primary" : "secondary"}>
              <KanbanSquare className="h-4 w-4" aria-hidden />
              Quadro
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant={active === "dashboard" ? "primary" : "secondary"}>
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Dashboard
            </Button>
          </Link>
          <Link href="/agenda">
            <Button variant={active === "agenda" ? "primary" : "secondary"}>
              <Calendar className="h-4 w-4" aria-hidden />
              Agenda
            </Button>
          </Link>
          {organizationId === NEXUS_ORG_ID && (
            <Link href="/dashboard/pdvnet">
              <Button variant={active === "pdvnet" ? "primary" : "secondary"}>
                <LineChart className="h-4 w-4" aria-hidden />
                PDVNET
              </Button>
            </Link>
          )}
          {isAdmin && (
            <Link href="/settings">
              <Button variant="secondary">
                <Settings className="h-4 w-4" aria-hidden />
                Configurações
              </Button>
            </Link>
          )}
          <NotificationBell currentUserId={currentUserId} membersById={membersById} />
          <ThemeToggle />
          <form action={logout}>
            <Button type="submit" variant="secondary">
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
