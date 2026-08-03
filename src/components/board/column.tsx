"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { clsx } from "clsx";
import { TicketCard } from "@/components/board/ticket-card";
import type { Tables } from "@/types/database.types";

export function Column({
  status,
  tickets,
  clientsById,
  ticketTypesById,
  membersById,
  onAddTicket,
  onSelectTicket,
}: {
  status: Tables<"statuses">;
  tickets: Tables<"tickets">[];
  clientsById: Map<string, string>;
  ticketTypesById: Map<string, string>;
  membersById: Map<string, string>;
  onAddTicket: () => void;
  onSelectTicket: (ticket: Tables<"tickets">) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/70 dark:bg-slate-900/60">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {status.name}
          </span>
          <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {tickets.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddTicket}
          aria-label="Adicionar chamado"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          "flex-1 space-y-2 rounded-b-xl px-3 pb-3 transition-colors",
          isOver && "bg-indigo-50 dark:bg-indigo-950/30"
        )}
        style={{ minHeight: 140 }}
      >
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            clientName={
              ticket.client_id ? clientsById.get(ticket.client_id) ?? null : null
            }
            typeName={
              ticket.type_id
                ? ticketTypesById.get(ticket.type_id) ?? null
                : null
            }
            developerName={
              ticket.developer_id
                ? membersById.get(ticket.developer_id) ?? null
                : null
            }
            onClick={() => onSelectTicket(ticket)}
          />
        ))}
      </div>
    </div>
  );
}
