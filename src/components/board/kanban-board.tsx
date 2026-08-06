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
import { Search, X, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Column } from "@/components/board/column";
import { FilterChip } from "@/components/board/filter-chip";
import { URGENCY_RANK } from "@/components/board/urgency-badge";
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(
    new Set()
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

  const terminalStatusIds = useMemo(
    () => new Set(statuses.filter((s) => s.is_terminal).map((s) => s.id)),
    [statuses]
  );

  const visibleTickets = useMemo(() => {
    let result = tickets;

    if (sprintFilter.length > 0) {
      result = result.filter((t) => sprintFilter.includes(t.sprint_id ?? "none"));
    }

    if (statusFilter.length > 0) {
      result = result.filter((t) => statusFilter.includes(t.status_id));
    }

    if (developerFilter.length > 0) {
      result = result.filter((t) =>
        developerFilter.includes(t.developer_id ?? "none")
      );
    }

    if (clientFilter.length > 0) {
      result = result.filter((t) => clientFilter.includes(t.client_id ?? "none"));
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
      result = result.filter((t) => {
        const developerName = t.developer_id ? developersById.get(t.developer_id) : null;
        const clientName = t.client_id ? clientsById.get(t.client_id) : null;
        return (
          t.title.toLowerCase().includes(query) ||
          (t.description ?? "").toLowerCase().includes(query) ||
          String(t.ticket_number).includes(query) ||
          (developerName?.toLowerCase().includes(query) ?? false) ||
          (clientName?.toLowerCase().includes(query) ?? false)
        );
      });
    }

    // Most urgent first within each column — otherwise cards just sit in
    // whatever order they were fetched (registration order), burying
    // critical/high tickets under older low-priority ones.
    return [...result].sort(
      (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]
    );
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
    developersById,
    clientsById,
  ]);

  const hasActiveFilters =
    statusFilter.length > 0 ||
    sprintFilter.length > 0 ||
    developerFilter.length > 0 ||
    clientFilter.length > 0 ||
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
      statusFilter.length === 0
        ? statuses
        : statuses.filter((s) => statusFilter.includes(s.id)),
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

  function toggleTicketSelection(ticketId: string) {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedTicketIds(new Set());
  }

  // Bulk status/sprint changes both go through move_ticket (not a plain
  // .update()) so ticket_history stays accurate — same reason the drag
  // handler and the detail dialog route status/sprint changes through it.
  async function handleBulkStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatusId = e.target.value;
    e.target.value = "";
    if (!newStatusId) return;

    const ids = Array.from(selectedTicketIds);
    const previous = tickets;
    setTickets((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, status_id: newStatusId } : t))
    );

    const supabase = createClient();
    const results = await Promise.all(
      ids.map((id) =>
        supabase.rpc("move_ticket", { p_ticket_id: id, p_new_status_id: newStatusId })
      )
    );

    const failedIds = ids.filter((_, i) => results[i].error);
    if (failedIds.length > 0) {
      setTickets((prev) =>
        prev.map((t) =>
          failedIds.includes(t.id) ? previous.find((p) => p.id === t.id) ?? t : t
        )
      );
      showToast(
        failedIds.length === ids.length
          ? "Não foi possível mudar o status dos chamados selecionados."
          : `Não foi possível mudar o status de ${failedIds.length} chamado(s).`
      );
    }

    exitSelectionMode();
  }

  async function handleBulkSprintChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    e.target.value = "";
    if (!value) return;
    const newSprintId = value === "none" ? null : value;

    const ids = Array.from(selectedTicketIds);
    const previous = tickets;
    setTickets((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, sprint_id: newSprintId } : t))
    );

    const supabase = createClient();
    const results = await Promise.all(
      ids.map((id) =>
        supabase.rpc("move_ticket", {
          p_ticket_id: id,
          p_new_sprint_id: newSprintId ?? undefined,
          p_sprint_explicitly_set: true,
        })
      )
    );

    const failedIds = ids.filter((_, i) => results[i].error);
    if (failedIds.length > 0) {
      setTickets((prev) =>
        prev.map((t) =>
          failedIds.includes(t.id) ? previous.find((p) => p.id === t.id) ?? t : t
        )
      );
      showToast(
        failedIds.length === ids.length
          ? "Não foi possível mudar a sprint dos chamados selecionados."
          : `Não foi possível mudar a sprint de ${failedIds.length} chamado(s).`
      );
    }

    exitSelectionMode();
  }

  // Developer assignment isn't logged in ticket_history (see the
  // developers-table note elsewhere in this project — developer is a
  // decoupled roster, not tied to move_ticket's status/sprint tracking),
  // so a single batched update is enough here, unlike the two handlers
  // above.
  async function handleBulkDeveloperChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    e.target.value = "";
    if (!value) return;
    const newDeveloperId = value === "none" ? null : value;

    const ids = Array.from(selectedTicketIds);
    const previous = tickets;
    setTickets((prev) =>
      prev.map((t) =>
        ids.includes(t.id) ? { ...t, developer_id: newDeveloperId } : t
      )
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("tickets")
      .update({ developer_id: newDeveloperId })
      .in("id", ids);

    if (error) {
      setTickets(previous);
      showToast(
        "Não foi possível atribuir o desenvolvedor aos chamados selecionados."
      );
    }

    exitSelectionMode();
  }

  // The board only scrolls horizontally (overflow-x-auto), but a plain
  // mouse wheel only ever produces vertical delta — trackpads that already
  // send horizontal delta (deltaX) are left alone. Without this, reaching
  // a column beyond the visible width required knowing to hold Shift or
  // drag the (invisible, unstyled) scrollbar, which is how a real column
  // ("Negado", added after this board already had more columns than fit
  // on screen) became effectively unreachable for a user scrolling normally.
  // Still lets a column's own ticket list (`.column-scroll-list`) scroll
  // vertically first when the cursor is over it and it isn't already at
  // its scroll boundary in that direction — otherwise scrolling a long
  // column would just shove the whole board sideways instead.
  function handleBoardWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    const container = e.currentTarget;
    if (container.scrollWidth <= container.clientWidth) return;

    const columnList = (e.target as HTMLElement).closest<HTMLElement>(
      ".column-scroll-list"
    );
    if (columnList && columnList.scrollHeight > columnList.clientHeight) {
      const atTop = columnList.scrollTop <= 0;
      const atBottom =
        columnList.scrollTop + columnList.clientHeight >=
        columnList.scrollHeight - 1;
      const scrollingDown = e.deltaY > 0;
      if ((scrollingDown && !atBottom) || (!scrollingDown && !atTop)) {
        return;
      }
    }

    e.preventDefault();
    container.scrollLeft += e.deltaY;
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedTicketIds);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Excluir ${ids.length} ${ids.length === 1 ? "chamado" : "chamados"}? Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("tickets").delete().in("id", ids);

    if (error) {
      showToast("Não foi possível excluir os chamados selecionados.");
      return;
    }

    setTickets((prev) => prev.filter((t) => !ids.includes(t.id)));
    exitSelectionMode();
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
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
              placeholder="Buscar por título, descrição, nº, dev. ou cliente"
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

          <button
            type="button"
            onClick={() => {
              if (selectionMode) {
                exitSelectionMode();
              } else {
                setSelectionMode(true);
              }
            }}
            aria-pressed={selectionMode}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              selectionMode
                ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
          >
            <CheckSquare className="h-3.5 w-3.5" aria-hidden />
            Selecionar chamados
          </button>

          <FilterChip
            label="Status"
            options={statuses.map((s) => ({ value: s.id, label: s.name }))}
            selected={statusFilter}
            onApply={setStatusFilter}
          />

          {sprints.length > 0 && (
            <FilterChip
              label="Sprint"
              options={[
                { value: "none", label: "Sem sprint" },
                ...sprints.map((s) => ({ value: s.id, label: s.name })),
              ]}
              selected={sprintFilter}
              onApply={setSprintFilter}
            />
          )}

          {developers.length > 0 && (
            <FilterChip
              label="Desenvolvedor"
              options={[
                { value: "none", label: "Sem desenvolvedor" },
                ...developers.map((d) => ({ value: d.id, label: d.name })),
              ]}
              selected={developerFilter}
              onApply={setDeveloperFilter}
            />
          )}

          {clients.length > 0 && (
            <FilterChip
              label="Cliente"
              options={[
                { value: "none", label: "Sem cliente" },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
              selected={clientFilter}
              onApply={setClientFilter}
            />
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

        {selectionMode && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 dark:border-indigo-900 dark:bg-indigo-950/30">
            <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
              {selectedTicketIds.size}{" "}
              {selectedTicketIds.size === 1 ? "selecionado" : "selecionados"}
            </span>

            <Select
              value=""
              onChange={handleBulkStatusChange}
              disabled={selectedTicketIds.size === 0}
              aria-label="Mudar status dos selecionados"
              className="w-44"
            >
              <option value="">Mudar status...</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>

            {developers.length > 0 && (
              <Select
                value=""
                onChange={handleBulkDeveloperChange}
                disabled={selectedTicketIds.size === 0}
                aria-label="Atribuir desenvolvedor aos selecionados"
                className="w-52"
              >
                <option value="">Atribuir desenvolvedor...</option>
                <option value="none">Sem desenvolvedor</option>
                {developers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}

            {sprints.length > 0 && (
              <Select
                value=""
                onChange={handleBulkSprintChange}
                disabled={selectedTicketIds.size === 0}
                aria-label="Atribuir sprint aos selecionados"
                className="w-44"
              >
                <option value="">Atribuir sprint...</option>
                <option value="none">Sem sprint</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedTicketIds.size === 0}
                className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Excluir
              </button>
            )}

            <button
              type="button"
              onClick={exitSelectionMode}
              className="ml-auto text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancelar seleção
            </button>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          onWheel={handleBoardWheel}
          className="board-scroll flex min-w-0 flex-1 gap-4 overflow-x-auto px-6 pb-6"
        >
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
              selectionMode={selectionMode}
              selectedTicketIds={selectedTicketIds}
              onToggleSelect={toggleTicketSelection}
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
              isTerminal={terminalStatusIds.has(activeTicket.status_id)}
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
