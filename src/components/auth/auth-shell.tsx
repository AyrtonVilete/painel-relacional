import { LogoMark } from "@/components/brand/logo-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AuthShell({
  children,
  headline,
  description,
}: {
  children: React.ReactNode;
  headline: string;
  description: string;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600 opacity-30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-fuchsia-600 opacity-20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:44px_44px]"
          aria-hidden
        />

        <div className="relative flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-semibold text-white">
            Painel Relacional
          </span>
        </div>

        <div className="relative max-w-md space-y-3">
          <h2 className="text-3xl font-semibold leading-tight text-white text-balance">
            {headline}
          </h2>
          <p className="text-[15px] leading-relaxed text-slate-400">
            {description}
          </p>
        </div>
      </div>

      <div className="relative flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <ThemeToggle className="absolute right-6 top-6 sm:right-12 lg:right-16" />

        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
              Painel Relacional
            </span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
