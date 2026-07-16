"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import type { ActionState } from "@/lib/actions/types";

const sprintSchema = z.object({
  name: z.string().min(1, "Informe um nome"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function createSprint(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = sprintSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const membership = await getCurrentMembership();
  if (!membership) {
    return { error: "Organização não encontrada" };
  }

  const supabase = await createClient();

  // MVP: one board per organization (the one created at signup), so we
  // just take the org's only board rather than asking the user to pick.
  const { data: board } = await supabase
    .from("boards")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .limit(1)
    .maybeSingle();

  if (!board) {
    return { error: "Quadro não encontrado" };
  }

  const { error } = await supabase.from("sprints").insert({
    board_id: board.id,
    name: parsed.data.name,
    start_date: parsed.data.startDate || null,
    end_date: parsed.data.endDate || null,
  });

  if (error) {
    return { error: "Não foi possível criar a sprint" };
  }

  revalidatePath("/settings/sprints");
}

export async function deleteSprint(id: string) {
  const supabase = await createClient();
  await supabase.from("sprints").delete().eq("id", id);
  revalidatePath("/settings/sprints");
}
