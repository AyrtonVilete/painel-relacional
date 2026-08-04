"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

export function FilterChip({
  label,
  options,
  selected,
  onApply,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onApply: (values: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function handleToggleOpen() {
    if (!isOpen) setDraft(selected);
    setIsOpen((prev) => !prev);
  }

  function handleToggleOption(value: string) {
    setDraft((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function handleApply() {
    onApply(draft);
    setIsOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-expanded={isOpen}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          selected.length > 0
            ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs font-medium text-white dark:bg-indigo-500">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-56 rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={draft.includes(option.value)}
                  onChange={() => handleToggleOption(option.value)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                />
                {option.label}
              </label>
            ))}
          </div>
          <div className="mt-1.5 border-t border-slate-200 px-2 pt-2 dark:border-slate-800">
            <button
              type="button"
              onClick={handleApply}
              className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
