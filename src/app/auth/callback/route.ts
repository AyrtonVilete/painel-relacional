import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Hit after the user clicks the confirmation link in the signup email.
// Exchanges the code for a session, then bootstraps the organization the
// user requested at signup (org_name/org_slug were stashed in user_metadata
// since create_organization_with_admin requires an authenticated session,
// which doesn't exist until this point when email confirmation is required).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: existingMemberships } = await supabase
        .from("memberships")
        .select("id")
        .limit(1);

      if (!existingMemberships || existingMemberships.length === 0) {
        const meta = data.user.user_metadata as {
          org_name?: string;
          org_slug?: string;
        };

        if (meta.org_name && meta.org_slug) {
          await supabase.rpc("create_organization_with_admin", {
            org_name: meta.org_name,
            org_slug: meta.org_slug,
          });
        }
      }

      return NextResponse.redirect(`${origin}/board`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
