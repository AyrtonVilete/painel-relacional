"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import type { ActionState } from "@/lib/actions/types";

const nameSchema = z.object({
  name: z.string().min(1, "Informe um nome").max(100),
});

export async function updateStatusTerminal(id: string, isTerminal: boolean) {
  const supabase = await createClient();
  await supabase.from("statuses").update({ is_terminal: isTerminal }).eq("id", id);
  revalidatePath("/settings/statuses");
  revalidatePath("/dashboard");
}

export async function updateStatusDenied(id: string, isDenied: boolean) {
  const supabase = await createClient();
  await supabase.from("statuses").update({ is_denied: isDenied }).eq("id", id);
  revalidatePath("/settings/statuses");
  revalidatePath("/board");
  revalidatePath("/dashboard");
}

export async function updateStatusApproved(id: string, isApproved: boolean) {
  const supabase = await createClient();
  await supabase.from("statuses").update({ is_approved: isApproved }).eq("id", id);
  revalidatePath("/settings/statuses");
  revalidatePath("/board");
  revalidatePath("/dashboard");
}

export async function updateStatusAwaitingApproval(
  id: string,
  isAwaitingApproval: boolean
) {
  const supabase = await createClient();
  await supabase
    .from("statuses")
    .update({ is_awaiting_approval: isAwaitingApproval })
    .eq("id", id);
  revalidatePath("/settings/statuses");
  revalidatePath("/board");
  revalidatePath("/dashboard");
}

export async function createStatus(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const membership = await getCurrentMembership();
  if (!membership) {
    return { error: "Organização não encontrada" };
  }

  const supabase = await createClient();

  // MVP: one board per organization, same assumption used by sprints.
  const { data: board } = await supabase
    .from("boards")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .limit(1)
    .maybeSingle();

  if (!board) {
    return { error: "Quadro não encontrado" };
  }

  const { data: existing } = await supabase
    .from("statuses")
    .select("order")
    .eq("board_id", board.id)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = existing ? existing.order + 1 : 0;

  const { error } = await supabase.from("statuses").insert({
    board_id: board.id,
    name: parsed.data.name,
    order: nextOrder,
  });

  if (error) {
    return { error: "Não foi possível criar o status" };
  }

  revalidatePath("/settings/statuses");
  revalidatePath("/board");
  revalidatePath("/dashboard");
}

export async function renameStatus(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const parsed = nameSchema.safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nome inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("statuses")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível renomear o status" };
  }

  revalidatePath("/settings/statuses");
  revalidatePath("/board");
  return {};
}

export async function deleteStatus(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("statuses").delete().eq("id", id);

  if (error) {
    // Postgres 23503 = foreign_key_violation — tickets.status_id references
    // statuses with ON DELETE RESTRICT, so this fires whenever a ticket is
    // still sitting in the column being deleted.
    if (error.code === "23503") {
      return {
        error:
          "Não é possível excluir: ainda há chamados nesse status. Mova-os para outra coluna primeiro.",
      };
    }
    return { error: "Não foi possível excluir o status" };
  }

  revalidatePath("/settings/statuses");
  revalidatePath("/board");
  revalidatePath("/dashboard");
  return {};
}

export async function moveStatus(
  id: string,
  direction: "up" | "down"
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("statuses")
    .select("id, board_id, order")
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return { error: "Status não encontrado" };
  }

  // Can't filter AND sort by "order" in the same PostgREST request — the
  // column name collides with PostgREST's own `?order=` query-string
  // parameter for sorting, so `.lt("order", x).order("order", ...)`
  // produces a malformed request (confirmed via a live PGRST100 parse
  // error: "lt.4,order.desc"). Fetch the board's statuses unsorted/
  // unfiltered on that column instead and find the neighbor in JS.
  const { data: siblings } = await supabase
    .from("statuses")
    .select("id, order")
    .eq("board_id", current.board_id);

  const candidates = (siblings ?? []).filter((s) =>
    direction === "up" ? s.order < current.order : s.order > current.order
  );

  const neighbor = candidates.reduce<typeof candidates[number] | null>(
    (closest, s) => {
      if (!closest) return s;
      const better =
        direction === "up" ? s.order > closest.order : s.order < closest.order;
      return better ? s : closest;
    },
    null
  );

  if (!neighbor) {
    return {};
  }

  const { error: error1 } = await supabase
    .from("statuses")
    .update({ order: neighbor.order })
    .eq("id", current.id);
  const { error: error2 } = await supabase
    .from("statuses")
    .update({ order: current.order })
    .eq("id", neighbor.id);

  if (error1 || error2) {
    return { error: "Não foi possível reordenar" };
  }

  revalidatePath("/settings/statuses");
  revalidatePath("/board");
  return {};
}
