import { createClient } from "@/lib/supabase/server";

export async function getCurrentMembership() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // RLS on `memberships` allows seeing every member row in any org you
  // belong to (needed for the members-list feature), not just your own —
  // so this must filter to the current user explicitly. Without it,
  // `.limit(1)` returns an arbitrary row from the org (in practice, the
  // first-created membership), silently reporting a different member's
  // role as your own.
  const { data } = await supabase
    .from("memberships")
    .select("role, organization_id, organizations(name, logo_url)")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}
