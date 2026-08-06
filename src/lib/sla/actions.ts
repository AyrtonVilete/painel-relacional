"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import type { Database } from "@/types/database.types";

type TicketUrgency = Database["public"]["Enums"]["ticket_urgency"];

const durationSchema = z.number().int().positive().max(8760);

export async function upsertSlaPolicy(
  urgency: TicketUrgency,
  durationHours: number
): Promise<{ error?: string }> {
  const parsed = durationSchema.safeParse(durationHours);
  if (!parsed.success) {
    return { error: "Informe um número de horas válido (1 a 8760)" };
  }

  const membership = await getCurrentMembership();
  if (!membership) {
    return { error: "Organização não encontrada" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sla_policies").upsert(
    {
      organization_id: membership.organization_id,
      urgency,
      duration_hours: parsed.data,
    },
    { onConflict: "organization_id,urgency" }
  );

  if (error) {
    return { error: "Não foi possível salvar o prazo de SLA" };
  }

  revalidatePath("/settings/sla");
  revalidatePath("/board");
  revalidatePath("/dashboard");
  return {};
}
