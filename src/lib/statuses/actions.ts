"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateStatusTerminal(id: string, isTerminal: boolean) {
  const supabase = await createClient();
  await supabase.from("statuses").update({ is_terminal: isTerminal }).eq("id", id);
  revalidatePath("/settings/statuses");
  revalidatePath("/dashboard");
}
