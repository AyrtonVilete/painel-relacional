"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import type { ActionState } from "@/lib/actions/types";

const nameSchema = z.object({
  name: z.string().min(1, "Informe um nome").max(200),
});

export async function createClientRecord(
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
  const { error } = await supabase.from("clients").insert({
    organization_id: membership.organization_id,
    name: parsed.data.name,
  });

  if (error) {
    return { error: "Não foi possível criar o cliente" };
  }

  revalidatePath("/settings/clients");
}

// One name per line of an uploaded .txt file. Dedupes case-insensitively
// (both within the file and against names already in the org) since a
// pasted export is a likely source for this and re-importing it shouldn't
// pile up duplicates — `clients.name` has no unique constraint at the DB
// level, so nothing else would catch that.
export async function bulkCreateClientRecords(
  names: string[]
): Promise<{ error?: string; importedCount?: number }> {
  const membership = await getCurrentMembership();
  if (!membership) {
    return { error: "Organização não encontrada" };
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || name.length > 200) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(name);
  }

  if (cleaned.length === 0) {
    return { error: "Nenhum nome válido encontrado no arquivo" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("clients")
    .select("name")
    .eq("organization_id", membership.organization_id);
  const existingNames = new Set(
    (existing ?? []).map((c) => c.name.toLowerCase())
  );

  const toInsert = cleaned.filter((name) => !existingNames.has(name.toLowerCase()));
  if (toInsert.length === 0) {
    return { error: "Todos os nomes do arquivo já estão cadastrados" };
  }

  const { error } = await supabase.from("clients").insert(
    toInsert.map((name) => ({
      organization_id: membership.organization_id,
      name,
    }))
  );

  if (error) {
    return { error: "Não foi possível importar os clientes" };
  }

  revalidatePath("/settings/clients");
  return { importedCount: toInsert.length };
}

export async function deleteClientRecord(id: string) {
  const supabase = await createClient();
  await supabase.from("clients").delete().eq("id", id);
  revalidatePath("/settings/clients");
}
