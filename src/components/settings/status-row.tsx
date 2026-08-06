"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Trash2, ChevronUp, ChevronDown, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import {
  renameStatus,
  deleteStatus,
  moveStatus,
} from "@/lib/statuses/actions";
import { StatusTerminalToggle } from "@/components/settings/status-terminal-toggle";
import { StatusDeniedToggle } from "@/components/settings/status-denied-toggle";
import { StatusAwaitingApprovalToggle } from "@/components/settings/status-awaiting-approval-toggle";

const iconButtonClass =
  "rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200";

export function StatusRow({
  status,
  isFirst,
  isLast,
}: {
  status: {
    id: string;
    name: string;
    is_terminal: boolean;
    is_denied: boolean;
    is_awaiting_approval: boolean;
  };
  isFirst: boolean;
  isLast: boolean;
}) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(status.name);

  function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === status.name) {
      setName(status.name);
      setIsEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await renameStatus(status.id, trimmed);
      if (result.error) {
        showToast(result.error);
        setName(status.name);
      }
      setIsEditing(false);
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Excluir o status "${status.name}"? Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteStatus(status.id);
      if (result.error) showToast(result.error);
    });
  }

  function handleMove(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveStatus(status.id, direction);
      if (result.error) showToast(result.error);
    });
  }

  return (
    <tr>
      <td className="w-10 px-2 py-2">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => handleMove("up")}
            disabled={isFirst || isPending}
            aria-label="Mover para cima"
            className={iconButtonClass}
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => handleMove("down")}
            disabled={isLast || isPending}
            aria-label="Mover para baixo"
            className={iconButtonClass}
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </td>
      <td className="px-3 py-3">
        {isEditing ? (
          <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={100}
              className="w-48"
            />
            <button type="submit" aria-label="Salvar" className={iconButtonClass}>
              <Check className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setName(status.name);
                setIsEditing(false);
              }}
              aria-label="Cancelar"
              className={iconButtonClass}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="group inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-200"
          >
            {status.name}
            <Pencil
              className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400"
              aria-hidden
            />
          </button>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <StatusTerminalToggle statusId={status.id} defaultChecked={status.is_terminal} />
      </td>
      <td className="px-3 py-3 text-right">
        <StatusDeniedToggle statusId={status.id} defaultChecked={status.is_denied} />
      </td>
      <td className="px-3 py-3 text-right">
        <StatusAwaitingApprovalToggle
          statusId={status.id}
          defaultChecked={status.is_awaiting_approval}
        />
      </td>
      <td className="w-12 px-3 py-3 text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          aria-label="Excluir status"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </td>
    </tr>
  );
}
