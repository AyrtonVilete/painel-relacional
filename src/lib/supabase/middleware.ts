import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth/callback",
  "/invite",
  "/api/notifications",
];
// /signup/confirmar-email matches the /signup prefix above, so no separate
// entry is needed — kept here as a note for discoverability.
// /api/notifications is called server-to-server by a Supabase database
// trigger (pg_net), never by a logged-in browser session — it has its own
// shared-secret check (verifyWebhookSecret) instead of the cookie-session
// check below. Without this, the redirect-to-/login response below hits a
// GET-only page with the original POST method preserved (NextResponse
// .redirect defaults to a 307), which Next.js answers with 405.

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

  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    const redirectUrl = new URL("/board", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
