import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Hit after the user clicks the confirmation link in the signup email.
// Only exchanges the code for a session. The organization requested at
// signup is no longer created here: /acesso/continuar does that once a
// platform admin has approved the person (until then it sends them to the
// "waiting for approval" screen).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/acesso/continuar`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
