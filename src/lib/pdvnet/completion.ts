import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { NEXUS_ORG_ID, PDVNET_CLOSED_STATES } from "@/lib/pdvnet/constants";

export type CompletionChange = {
  ticketNumber: number;
  fromStatus: string;
  completedAt: string;
};

// Moves a chamado to "Concluído" in our Quadro once Azure DevOps says the
// work is done (state "Done"), instead of someone dragging the card by hand.
//
// Reads only pdvnet_tickets, the mirror the same cron run has just refreshed
// from DevOps — no extra calls to Azure DevOps, and never a write to it.
//
// A chamado counts as concluded when at least one of its work items is Done
// and none is still open. Removed / Not Approved items are ignored (they say
// nothing about the work being finished), and a chamado that only has those
// is left alone. Chamados already concluded or denied in the Quadro are not
// touched.
export async function syncCompletionFromAdo(options?: {
  dryRun?: boolean;
}): Promise<{ checked: number; changes: CompletionChange[] }> {
  const supabase = createAdminClient();

  const [{ data: tickets, error: ticketsError }, { data: boards, error: boardsError }] =
    await Promise.all([
      supabase
        .from("tickets")
        .select("id, ticket_number, status_id, board_id, sprint_id")
        .eq("organization_id", NEXUS_ORG_ID),
      supabase.from("boards").select("id").eq("organization_id", NEXUS_ORG_ID),
    ]);
  if (ticketsError) throw new Error(`Fetching tickets failed: ${ticketsError.message}`);
  if (boardsError) throw new Error(`Fetching boards failed: ${boardsError.message}`);

  const { data: statuses, error: statusesError } = await supabase
    .from("statuses")
    .select("id, name, board_id, order, is_terminal, is_denied")
    .in(
      "board_id",
      (boards ?? []).map((b) => b.id)
    );
  if (statusesError) throw new Error(`Fetching statuses failed: ${statusesError.message}`);

  const statusById = new Map((statuses ?? []).map((s) => [s.id, s]));
  // The "Concluído" column of each board: its first terminal status.
  const concludedStatusByBoard = new Map<string, { id: string; order: number }>();
  for (const s of statuses ?? []) {
    if (!s.is_terminal) continue;
    const current = concludedStatusByBoard.get(s.board_id);
    if (!current || s.order < current.order) {
      concludedStatusByBoard.set(s.board_id, { id: s.id, order: s.order });
    }
  }

  const openTickets = (tickets ?? []).filter((t) => {
    const status = statusById.get(t.status_id);
    return status && !status.is_terminal && !status.is_denied;
  });
  if (openTickets.length === 0) return { checked: 0, changes: [] };

  const adoItems: {
    chamado: number | null;
    state: string;
    closed_date: string | null;
    changed_date: string | null;
  }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("pdvnet_tickets")
      .select("chamado, state, closed_date, changed_date")
      .eq("organization_id", NEXUS_ORG_ID)
      .not("chamado", "is", null)
      .range(offset, offset + 999);
    if (error) throw new Error(`Fetching pdvnet_tickets failed: ${error.message}`);
    adoItems.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  // chamado -> { concluded, when }
  const byChamado = new Map<number, { done: boolean; stillOpen: boolean; closedAt: string | null }>();
  for (const item of adoItems) {
    if (item.chamado === null) continue;
    const entry = byChamado.get(Number(item.chamado)) ?? {
      done: false,
      stillOpen: false,
      closedAt: null,
    };
    if (item.state === "Done") {
      entry.done = true;
      const closed = item.closed_date ?? item.changed_date;
      if (closed && (!entry.closedAt || closed > entry.closedAt)) entry.closedAt = closed;
    } else if (!PDVNET_CLOSED_STATES.includes(item.state)) {
      entry.stillOpen = true;
    }
    byChamado.set(Number(item.chamado), entry);
  }

  const changes: CompletionChange[] = [];
  for (const ticket of openTickets) {
    const ado = byChamado.get(ticket.ticket_number);
    if (!ado || !ado.done || ado.stillOpen) continue;

    const target = concludedStatusByBoard.get(ticket.board_id);
    if (!target) continue;

    // DevOps's real closing moment; the moment of the sync only as a fallback.
    const completedAt = ado.closedAt ?? new Date().toISOString();
    changes.push({
      ticketNumber: ticket.ticket_number,
      fromStatus: statusById.get(ticket.status_id)?.name ?? "—",
      completedAt,
    });
    if (options?.dryRun) continue;

    // History first (moved_by null = done by the sync, not by a person). If
    // it is refused — migration 0034 not applied yet — nothing is moved, so
    // the board never shows a move the history doesn't know about.
    const { data: history, error: historyError } = await supabase
      .from("ticket_history")
      .insert({
        ticket_id: ticket.id,
        from_status_id: ticket.status_id,
        to_status_id: target.id,
        from_sprint_id: ticket.sprint_id,
        to_sprint_id: ticket.sprint_id,
        moved_by: null,
      })
      .select("id")
      .single();
    if (historyError || !history) {
      throw new Error(
        `Recording the move of chamado ${ticket.ticket_number} failed (migration 0034 applied?): ${historyError?.message}`
      );
    }

    const { error: updateError } = await supabase
      .from("tickets")
      .update({ status_id: target.id, completed_at: completedAt })
      .eq("id", ticket.id);
    if (updateError) {
      await supabase.from("ticket_history").delete().eq("id", history.id);
      throw new Error(
        `Concluding chamado ${ticket.ticket_number} failed: ${updateError.message}`
      );
    }
  }

  return { checked: openTickets.length, changes };
}
