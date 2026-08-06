"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { upsertFollowupPolicy } from "@/lib/followup/actions";
import { URGENCY_LABELS } from "@/components/board/urgency-badge";
import type { Database } from "@/types/database.types";

type TicketUrgency = Database["public"]["Enums"]["ticket_urgency"];

function formatDaysHint(hours: number) {
  const days = hours / 24;
  const rounded = Math.round(days * 10) / 10;
  return `≈ ${rounded} ${rounded === 1 ? "dia" : "dias"}`;
}

export function FollowupPolicyRow({
  urgency,
  intervalHours,
}: {
  urgency: TicketUrgency;
  intervalHours: number;
}) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(String(intervalHours));

  const isDirty = value !== String(intervalHours) && value.trim() !== "";
  const parsedValue = Number(value);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      showToast("Informe um número de horas válido");
      return;
    }
    startTransition(async () => {
      const result = await upsertFollowupPolicy(urgency, parsedValue);
      if (result.error) showToast(result.error);
    });
  }

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
        {URGENCY_LABELS[urgency]}
      </td>
      <td className="px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={8760}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24"
            aria-label={`Intervalo de cobrança para urgência ${URGENCY_LABELS[urgency]}, em horas`}
          />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            horas ({formatDaysHint(Number.isFinite(parsedValue) ? parsedValue : intervalHours)})
          </span>
          <button
            type="submit"
            disabled={!isDirty || isPending}
            aria-label="Salvar intervalo"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
          >
            <Check className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </td>
    </tr>
  );
}
