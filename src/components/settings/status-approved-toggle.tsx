"use client";

import { useTransition } from "react";
import { updateStatusApproved } from "@/lib/statuses/actions";

export function StatusApprovedToggle({
  statusId,
  defaultChecked,
}: {
  statusId: string;
  defaultChecked: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        disabled={isPending}
        onChange={(e) => {
          const checked = e.target.checked;
          startTransition(() => {
            updateStatusApproved(statusId, checked);
          });
        }}
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
      />
      Coluna de aprovados
    </label>
  );
}
