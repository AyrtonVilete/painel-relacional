"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import type { Database } from "@/types/database.types";

type TicketUrgency = Database["public"]["Enums"]["ticket_urgency"];

const intervalSchema = z.number().int().positive().max(8760);

export async function upsertFollowupPolicy(
  urgency: TicketUrgency,
  intervalHours: number
): Promise<{ error?: string }> {
  const parsed = intervalSchema.safeParse(intervalHours);
  if (!parsed.success) {
    return { error: "Informe um número de horas válido (1 a 8760)" };
  }

  const membership = await getCurrentMembership();
  if (!membership) {
    return { error: "Organização não encontrada" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("followup_policies").upsert(
    {
      organization_id: membership.organization_id,
      urgency,
      interval_hours: parsed.data,
    },
    { onConflict: "organization_id,urgency" }
  );

  if (error) {
    return { error: "Não foi possível salvar o intervalo de cobrança" };
  }

  revalidatePath("/settings/followup");
  revalidatePath("/board");
  revalidatePath("/dashboard");
  return {};
}
