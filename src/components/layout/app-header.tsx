import Link from "next/link";
import { KanbanSquare, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AppHeader({
  orgName,
  userEmail,
  role,
  isAdmin,
  active,
}: {
  orgName: string;
  userEmail: string | undefined;
  role: string | null;
  isAdmin: boolean;
  active: "board" | "dashboard";
}) {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <LogoMark />
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
          {isAdmin && (
            <Link href="/settings">
              <Button variant="secondary">
                <Settings className="h-4 w-4" aria-hidden />
                Configurações
              </Button>
            </Link>
          )}
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
