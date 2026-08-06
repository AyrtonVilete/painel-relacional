"use client";

import { useDraggable } from "@dnd-kit/core";
import { useEffect, useState } from "react";
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

const SLA_TICK_MS = 60_000;
const SLA_SOON_THRESHOLD_MS = 4 * 60 * 60 * 1000;

function formatSlaRemaining(ms: number) {
  const totalMinutes = Math.floor(Math.abs(ms) / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

// Separate concept from the deadline badge above: sla_due_at is an
// automatic internal target computed from urgency (see /settings/sla),
// not the manual client-facing deadline. Ticks every 60s so "vence em Xh"
// stays roughly current without re-rendering every second.
function SlaBadge({ slaDueAt }: { slaDueAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), SLA_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = new Date(slaDueAt).getTime() - now;
  const isBreached = remainingMs < 0;
  const isSoon = !isBreached && remainingMs <= SLA_SOON_THRESHOLD_MS;

  return (
    <p
      className={clsx(
        "mt-1 flex items-center gap-1 text-xs",
        isBreached
          ? "font-medium text-red-600 dark:text-red-400"
          : isSoon
            ? "font-medium text-amber-600 dark:text-amber-400"
            : "text-slate-400 dark:text-slate-500"
      )}
    >
      {isBreached && <AlertTriangle className="h-3 w-3" aria-hidden />}
      {isBreached
        ? `SLA estourado há ${formatSlaRemaining(remainingMs)}`
        : `SLA: vence em ${formatSlaRemaining(remainingMs)}`}
    </p>
  );
}

export function TicketCard({
  ticket,
  clientName,
  typeName,
  developerName,
  isTerminal,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onClick,
}: {
  ticket: Tables<"tickets">;
  clientName: string | null;
  typeName: string | null;
  developerName: string | null;
  isTerminal: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket.id, disabled: selectionMode });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  function handleClick() {
    if (selectionMode) {
      onToggleSelect?.();
      return;
    }
    onClick();
  }

  // Enter opens the detail dialog (the accessible way to change status —
  // it has its own status <Select>), while other keys (notably Space)
  // still go to dnd-kit's own listener so keyboard-driven drag still works.
  // In selection mode, Enter toggles selection instead, matching the click
  // behavior above.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleClick();
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
      onClick={handleClick}
      aria-label={`Chamado número ${ticket.ticket_number}: ${ticket.title}`}
      className={clsx(
        "cursor-pointer touch-none overflow-hidden rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900",
        isSelected
          ? "border-indigo-500 ring-2 ring-indigo-500/40 dark:border-indigo-400"
          : "border-slate-200 dark:border-slate-800",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        {selectionMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect?.()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Selecionar chamado ${ticket.ticket_number}`}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            #{ticket.ticket_number}
          </p>
          <p className="break-words text-sm font-medium leading-snug text-slate-800 dark:text-slate-100">
            {ticket.title}
          </p>
        </div>
      </div>

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

      {ticket.sla_due_at && !isTerminal && (
        <SlaBadge slaDueAt={ticket.sla_due_at} />
      )}
    </div>
  );
}
