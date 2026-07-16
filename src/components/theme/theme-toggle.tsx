"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";
import { THEME_STORAGE_KEY } from "@/lib/theme/script";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
      }
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600",
        "transition-colors hover:bg-slate-50",
        "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
        className
      )}
    >
      {theme === null ? null : theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
