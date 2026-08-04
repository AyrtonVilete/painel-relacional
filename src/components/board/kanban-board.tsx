"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Search, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Column } from "@/components/board/column";
import { TicketCard } from "@/components/board/ticket-card";
import { CreateTicketDialog } from "@/components/board/create-ticket-dialog";
import { TicketDetailDialog } from "@/components/board/ticket-detail-dialog";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  DEFAULT_BOARD_FILTERS,
  type BoardFilters,
} from "@/lib/board/layout-preferences";
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
  developers,
  currentUserId,
  initialFilters,
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
  developers: { id: string; name: string }[];
  currentUserId: string;
  initialFilters: BoardFilters;
  canApprove: boolean;
  isAdmin: boolean;
}) {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState(initialTickets);
  const [sprintFilter, setSprintFilter] = useState(initialFilters.sprintFilter);
  const [statusFilter, setStatusFilter] = useState(initialFilters.statusFilter);
  const [developerFilter, setDeveloperFilter] = useState(
    initialFilters.developerFilter
  );
  const [clientFilter, setClientFilter] = useState(initialFilters.clientFilter);
  const [onlyMine, setOnlyMine] = useState(initialFilters.onlyMine);
  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
  const [createdFrom, setCreatedFrom] = useState(initialFilters.createdFrom);
  const [createdTo, setCreatedTo] = useState(initialFilters.createdTo);
  const [activeTicket, setActiveTicket] = useState<Tables<"tickets"> | null>(
    null
  );
  const [createStatusId, setCreateStatusId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Tables<"tickets"> | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Persist filter state per user/board so it survives reloads — skips the
  // mount render (that's just what was just loaded from layout_preferences,
  // re-saving it would be a no-op write) and debounces so fast changes
  // (e.g. typing in the search box) don't fire a request per keystroke.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!currentUserId) return;

    const timeout = setTimeout(() => {
      const supabase = createClient();
      supabase
        .from("layout_preferences")
        .upsert(
          {
            user_id: currentUserId,
            board_id: boardId,
            layout_json: {
              statusFilter,
              sprintFilter,
              developerFilter,
              clientFilter,
              onlyMine,
              searchQuery,
              createdFrom,
              createdTo,
            },
          },
          { onConflict: "user_id,board_id" }
        )
        .then(() => {});
    }, 600);

    return () => clearTimeout(timeout);
  }, [
    currentUserId,
    boardId,
    statusFilter,
    sprintFilter,
    developerFilter,
    clientFilter,
    onlyMine,
    searchQuery,
    createdFrom,
    createdTo,
  ]);

  const clientsById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients]
  );
  const ticketTypesById = useMemo(
    () => new Map(ticketTypes.map((t) => [t.id, t.name])),
    [ticketTypes]
  );

  const developersById = useMemo(
    () => new Map(developers.map((d) => [d.id, d.name])),
    [developers]
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

    if (clientFilter === "none") {
      result = result.filter((t) => !t.client_id);
    } else if (clientFilter !== "all") {
      result = result.filter((t) => t.client_id === clientFilter);
    }

    if (onlyMine) {
      result = result.filter((t) => t.created_by === currentUserId);
    }

    if (createdFrom) {
      result = result.filter((t) => t.created_at.slice(0, 10) >= createdFrom);
    }
    if (createdTo) {
      result = result.filter((t) => t.created_at.slice(0, 10) <= createdTo);
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
  }, [
    tickets,
    sprintFilter,
    statusFilter,
    developerFilter,
    clientFilter,
    onlyMine,
    currentUserId,
    searchQuery,
    createdFrom,
    createdTo,
  ]);

  const hasActiveFilters =
    statusFilter !== DEFAULT_BOARD_FILTERS.statusFilter ||
    sprintFilter !== DEFAULT_BOARD_FILTERS.sprintFilter ||
    developerFilter !== DEFAULT_BOARD_FILTERS.developerFilter ||
    clientFilter !== DEFAULT_BOARD_FILTERS.clientFilter ||
    onlyMine !== DEFAULT_BOARD_FILTERS.onlyMine ||
    searchQuery.trim() !== "" ||
    createdFrom !== "" ||
    createdTo !== "";

  function handleClearFilters() {
    setStatusFilter(DEFAULT_BOARD_FILTERS.statusFilter);
    setSprintFilter(DEFAULT_BOARD_FILTERS.sprintFilter);
    setDeveloperFilter(DEFAULT_BOARD_FILTERS.developerFilter);
    setClientFilter(DEFAULT_BOARD_FILTERS.clientFilter);
    setOnlyMine(DEFAULT_BOARD_FILTERS.onlyMine);
    setSearchQuery(DEFAULT_BOARD_FILTERS.searchQuery);
    setCreatedFrom(DEFAULT_BOARD_FILTERS.createdFrom);
    setCreatedTo(DEFAULT_BOARD_FILTERS.createdTo);
  }

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
          showToast("Não foi possível mover o chamado. Tente novamente.");
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
      <div className="mb-4 space-y-3 px-6 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {visibleTickets.length}{" "}
            {visibleTickets.length === 1 ? "chamado" : "chamados"}
          </p>

          <button
            type="button"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              hasActiveFilters
                ? "text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                : "cursor-not-allowed text-slate-300 dark:text-slate-700"
            )}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpar filtros
          </button>
        </div>

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

          <button
            type="button"
            onClick={() => setOnlyMine((prev) => !prev)}
            aria-pressed={onlyMine}
            className={clsx(
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              onlyMine
                ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
          >
            Meus chamados
          </button>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-56"
            aria-label="Filtrar por status"
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
              aria-label="Filtrar por sprint"
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

          {clients.length > 0 && (
            <Select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-56"
              aria-label="Filtrar por cliente"
            >
              <option value="all">Todos os clientes</option>
              <option value="none">Sem cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Cadastrado:
            </span>
            <Input
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              aria-label="Cadastrado a partir de"
              className="w-36"
            />
            <span className="text-sm text-slate-400 dark:text-slate-500">até</span>
            <Input
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              aria-label="Cadastrado até"
              className="w-36"
            />
          </div>
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
              developersById={developersById}
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
                  ? developersById.get(activeTicket.developer_id) ?? null
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
          currentUserId={currentUserId}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
