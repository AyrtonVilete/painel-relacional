"use client";

import { useDraggable } from "@dnd-kit/core";
import { clsx } from "clsx";
import { UrgencyBadge } from "@/components/board/urgency-badge";
import type { Tables } from "@/types/database.types";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={clsx(
        "cursor-pointer touch-none rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
        isDragging && "opacity-40"
      )}
    >
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
        #{ticket.ticket_number}
      </p>
      <p className="text-sm font-medium leading-snug text-slate-800 dark:text-slate-100">
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
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Prazo: {formatDate(ticket.deadline)}
        </p>
      )}
    </div>
  );
}
