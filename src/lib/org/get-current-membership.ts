import { createClient } from "@/lib/supabase/server";

export async function getCurrentMembership() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("memberships")
    .select("role, organization_id, organizations(name)")
    .limit(1)
    .maybeSingle();

  return data;
}
