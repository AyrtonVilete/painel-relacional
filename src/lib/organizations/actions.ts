"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";

const urlSchema = z.string().trim().max(2000).url();

function revalidateHeaderPaths() {
  revalidatePath("/settings/organization");
  revalidatePath("/board");
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
}

// Covers all three flows from the settings page (paste a link, finish an
// upload, or clear it) — pass null to clear. The file itself is uploaded
// client-side straight to Storage (same pattern as ticket attachments);
// this only ever persists the resulting URL string.
export async function setOrganizationLogoUrl(
  url: string | null
): Promise<{ error?: string }> {
  let value: string | null = null;
  if (url !== null) {
    const parsed = urlSchema.safeParse(url);
    if (!parsed.success) {
      return { error: "Informe uma URL válida" };
    }
    value = parsed.data;
  }

  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "admin") {
    return { error: "Apenas administradores podem alterar o logo" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: value })
    .eq("id", membership.organization_id);

  if (error) {
    return { error: "Não foi possível salvar o logo" };
  }

  revalidateHeaderPaths();
  return {};
}
