"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function ImportTxtButton({
  action,
  label,
}: {
  action: (names: string[]) => Promise<{ error?: string; importedCount?: number }>;
  label: string;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [isImporting, setIsImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    setIsImporting(true);
    const text = await file.text();
    const names = text.split(/\r?\n/);
    const result = await action(names);
    setIsImporting(false);

    if (result.error) {
      showToast(result.error);
      return;
    }

    showToast(
      `${result.importedCount} ${result.importedCount === 1 ? "cliente importado" : "clientes importados"}`,
      "success"
    );
    router.refresh();
  }

  return (
    <div>
      <label className="inline-block">
        <span
          className={
            "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" +
            (isImporting ? " pointer-events-none opacity-50" : "")
          }
        >
          <Upload className="h-4 w-4" aria-hidden />
          {isImporting ? "Importando..." : label}
        </span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          disabled={isImporting}
          onChange={handleFileChange}
          accept=".txt,text/plain"
        />
      </label>
      <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
        Um cliente por linha do arquivo .txt
      </p>
    </div>
  );
}
