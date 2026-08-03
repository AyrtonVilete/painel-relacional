"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Column } from "@/components/board/column";
import { TicketCard } from "@/components/board/ticket-card";
import { CreateTicketDialog } from "@/components/board/create-ticket-dialog";
import { TicketDetailDialog } from "@/components/board/ticket-detail-dialog";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export function KanbanBoard({
  boardId,
  organizationId,
  statuses,
  initialTickets,
  clients,
  ticketTypes,
  sprints,
  membersById,
  canApprove,
  isAdmin,
}: {
  boardId: string;
  organizationId: string;
  statuses: Tables<"statuses">[];
  initialTickets: Tables<"tickets">[];
  clients: Tables<"clients">[];
  ticketTypes: Tables<"ticket_types">[];
  sprints: Tables<"sprints">[];
  membersById: Map<string, string>;
  canApprove: boolean;
  isAdmin: boolean;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [developerFilter, setDeveloperFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTicket, setActiveTicket] = useState<Tables<"tickets"> | null>(
    null
  );
  const [createStatusId, setCreateStatusId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Tables<"tickets"> | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const clientsById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients]
  );
  const ticketTypesById = useMemo(
    () => new Map(ticketTypes.map((t) => [t.id, t.name])),
    [ticketTypes]
  );

  const developers = useMemo(
    () =>
      Array.from(membersById, ([id, name]) => ({ id, name })).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [membersById]
  );

  const visibleTickets = useMemo(() => {
    let result = tickets;

    if (sprintFilter === "none") {
      result = result.filter((t) => !t.sprint_id);
    } else if (sprintFilter !== "all") {
      result = result.filter((t) => t.sprint_id === sprintFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status_id === statusFilter);
    }

    if (developerFilter === "none") {
      result = result.filter((t) => !t.developer_id);
    } else if (developerFilter !== "all") {
      result = result.filter((t) => t.developer_id === developerFilter);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.description ?? "").toLowerCase().includes(query) ||
          String(t.ticket_number).includes(query)
      );
    }

    return result;
  }, [tickets, sprintFilter, statusFilter, developerFilter, searchQuery]);

  const visibleStatuses = useMemo(
    () =>
      statusFilter === "all"
        ? statuses
        : statuses.filter((s) => s.id === statusFilter),
    [statuses, statusFilter]
  );

  function handleDragStart(event: DragStartEvent) {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    const ticketId = String(active.id);
    const newStatusId = String(over.id);
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status_id === newStatusId) return;

    const previousStatusId = ticket.status_id;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId ? { ...t, status_id: newStatusId } : t
      )
    );

    const supabase = createClient();
    supabase
      .rpc("move_ticket", { p_ticket_id: ticketId, p_new_status_id: newStatusId })
      .then(({ error }) => {
        if (error) {
          setTickets((prev) =>
            prev.map((t) =>
              t.id === ticketId ? { ...t, status_id: previousStatusId } : t
            )
          );
        }
      });
  }

  function handleCreated(ticket: Tables<"tickets">) {
    setTickets((prev) => [...prev, ticket]);
  }

  function handleUpdated(ticket: Tables<"tickets">) {
    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
    setSelectedTicket(ticket);
  }

  function handleDeleted(ticketId: string) {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-6 pt-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {visibleTickets.length}{" "}
          {visibleTickets.length === 1 ? "chamado" : "chamados"}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, descrição ou nº do chamado"
              className="w-72 pl-9"
              aria-label="Buscar chamados"
            />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-56"
          >
            <option value="all">Todos os status</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          {sprints.length > 0 && (
            <Select
              value={sprintFilter}
              onChange={(e) => setSprintFilter(e.target.value)}
              className="w-56"
            >
              <option value="all">Todos os chamados</option>
              <option value="none">Sem sprint</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}

          {developers.length > 0 && (
            <Select
              value={developerFilter}
              onChange={(e) => setDeveloperFilter(e.target.value)}
              className="w-56"
              aria-label="Filtrar por desenvolvedor"
            >
              <option value="all">Todos os desenvolvedores</option>
              <option value="none">Sem desenvolvedor</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto px-6 pb-6">
          {visibleStatuses.map((status) => (
            <Column
              key={status.id}
              status={status}
              tickets={visibleTickets.filter((t) => t.status_id === status.id)}
              clientsById={clientsById}
              ticketTypesById={ticketTypesById}
              membersById={membersById}
              onAddTicket={() => setCreateStatusId(status.id)}
              onSelectTicket={setSelectedTicket}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTicket && (
            <TicketCard
              ticket={activeTicket}
              clientName={
                activeTicket.client_id
                  ? clientsById.get(activeTicket.client_id) ?? null
                  : null
              }
              typeName={
                activeTicket.type_id
                  ? ticketTypesById.get(activeTicket.type_id) ?? null
                  : null
              }
              developerName={
                activeTicket.developer_id
                  ? membersById.get(activeTicket.developer_id) ?? null
                  : null
              }
              onClick={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>

      {createStatusId && (
        <CreateTicketDialog
          open
          onClose={() => setCreateStatusId(null)}
          statusId={createStatusId}
          organizationId={organizationId}
          boardId={boardId}
          clients={clients}
          ticketTypes={ticketTypes}
          sprints={sprints}
          developers={developers}
          onCreated={handleCreated}
        />
      )}

      {selectedTicket && (
        <TicketDetailDialog
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          statuses={statuses}
          sprints={sprints}
          clients={clients}
          ticketTypes={ticketTypes}
          membersById={membersById}
          developers={developers}
          canApprove={canApprove}
          isAdmin={isAdmin}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
