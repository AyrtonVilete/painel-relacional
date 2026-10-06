import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAccessApproved } from "@/lib/auth/access";
import type { Database } from "@/types/database.types";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth/callback",
  "/invite",
  "/api/notifications",
  "/api/cron",
];
// The only places a signed-in-but-unapproved user may be: the waiting
// screen, and /acesso/continuar, which sends them there (or onward once
// approved).
const UNAPPROVED_ALLOWED_PATHS = ["/aguardando-aprovacao", "/acesso"];
// /signup/confirmar-email matches the /signup prefix above, so no separate
// entry is needed — kept here as a note for discoverability.
// /api/notifications is called server-to-server by a Supabase database
// trigger (pg_net), never by a logged-in browser session — it has its own
// shared-secret check (verifyWebhookSecret) instead of the cookie-session
// check below. Without this, the redirect-to-/login response below hits a
// GET-only page with the original POST method preserved (NextResponse
// .redirect defaults to a 307), which Next.js answers with 405.
// /api/cron is called server-to-server by Vercel Cron, same reasoning —
// its own Authorization: Bearer CRON_SECRET check stands in for the
// cookie-session check below.

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && !isPublicPath) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Signed in but not approved yet: nothing in the product is reachable
  // except the "waiting" screens. Checked against getUser() above (a live
  // call to Auth, not the cached JWT), so approving or revoking someone
  // takes effect on their very next request.
  if (
    user &&
    !isPublicPath &&
    !isAccessApproved(user) &&
    !UNAPPROVED_ALLOWED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))
  ) {
    return NextResponse.redirect(new URL("/aguardando-aprovacao", request.url));
  }

  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    const redirectUrl = new URL("/board", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
