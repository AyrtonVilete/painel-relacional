"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import type { ActionState } from "@/lib/actions/types";

const nameSchema = z.object({
  name: z.string().min(1, "Informe um nome").max(200),
});

export async function createTicketType(
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
  const { error } = await supabase.from("ticket_types").insert({
    organization_id: membership.organization_id,
    name: parsed.data.name,
  });

  if (error) {
    return { error: "Não foi possível criar o tipo de chamado" };
  }

  revalidatePath("/settings/ticket-types");
}

export async function deleteTicketType(id: string) {
  const supabase = await createClient();
  await supabase.from("ticket_types").delete().eq("id", id);
  revalidatePath("/settings/ticket-types");
}
