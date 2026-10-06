import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAccessApproved } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// Single place that decides where a signed-in person goes next: login, the
// email-confirmation link, and the waiting screen all funnel through here.
// A route handler (not a page) because it may refresh the session, which
// writes cookies — a Server Component can't.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!isAccessApproved(user)) {
    return NextResponse.redirect(`${origin}/aguardando-aprovacao`);
  }

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (!memberships || memberships.length === 0) {
    const meta = user.user_metadata as { org_name?: string; org_slug?: string };

    // The organization requested at signup is only created now, once the
    // person has been approved — not at signup, when anyone on the internet
    // could have filled it in. Refresh first so the new access token already
    // carries the approval (the one from before approval doesn't).
    if (meta.org_name && meta.org_slug) {
      await supabase.auth.refreshSession();
      await supabase.rpc("create_organization_with_admin", {
        org_name: meta.org_name,
        org_slug: meta.org_slug,
      });
    }
  }

  return NextResponse.redirect(`${origin}/board`);
}
