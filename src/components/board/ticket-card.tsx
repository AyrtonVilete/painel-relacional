"use client";

import { useDraggable } from "@dnd-kit/core";
import { clsx } from "clsx";
import { AlertTriangle } from "lucide-react";
import { UrgencyBadge } from "@/components/board/urgency-badge";
import type { Tables } from "@/types/database.types";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Plain date comparison (no time-of-day/timezone component) since
// `deadline` is a DB `date` column, not a timestamp.
function getDeadlineStatus(deadline: string): "overdue" | "soon" | "normal" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${deadline}T00:00:00`);
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / ONE_DAY_MS);

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 2) return "soon";
  return "normal";
}

export function TicketCard({
  ticket,
  clientName,
  typeName,
  developerName,
  onClick,
}: {
  ticket: Tables<"tickets">;
  clientName: string | null;
  typeName: string | null;
  developerName: string | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  // Enter opens the detail dialog (the accessible way to change status —
  // it has its own status <Select>), while other keys (notably Space)
  // still go to dnd-kit's own listener so keyboard-driven drag still works.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onClick();
      return;
    }
    listeners?.onKeyDown?.(e);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      aria-label={`Chamado número ${ticket.ticket_number}: ${ticket.title}`}
      className={clsx(
        "cursor-pointer touch-none overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
        isDragging && "opacity-40"
      )}
    >
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
        #{ticket.ticket_number}
      </p>
      <p className="break-words text-sm font-medium leading-snug text-slate-800 dark:text-slate-100">
        {ticket.title}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <UrgencyBadge urgency={ticket.urgency} />
        {!ticket.approved && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            Pendente
          </span>
        )}
      </div>

      {(clientName || typeName) && (
        <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">
          {[clientName, typeName].filter(Boolean).join(" · ")}
        </p>
      )}

      {developerName && (
        <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
          Dev: {developerName}
        </p>
      )}

      {ticket.deadline && (
        <p
          className={clsx(
            "mt-1 flex items-center gap-1 text-xs",
            getDeadlineStatus(ticket.deadline) === "overdue"
              ? "font-medium text-red-600 dark:text-red-400"
              : getDeadlineStatus(ticket.deadline) === "soon"
                ? "font-medium text-amber-600 dark:text-amber-400"
                : "text-slate-400 dark:text-slate-500"
          )}
        >
          {getDeadlineStatus(ticket.deadline) === "overdue" && (
            <AlertTriangle className="h-3 w-3" aria-hidden />
          )}
          Prazo: {formatDate(ticket.deadline)}
        </p>
      )}
    </div>
  );
}
