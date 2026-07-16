import { createClient } from "@/lib/supabase/client";

// Email action links (invite, recovery, ...) generated via the admin API
// use the implicit flow — tokens arrive in the URL hash fragment, which
// only ever exists client-side (browsers never send it to the server).
// Self-initiated flows (signup confirmation via the SSR server client)
// use PKCE instead, arriving as a `?code=` query param. This helper
// handles both so the same acceptance page works regardless of which
// flow produced the link.
export async function establishSessionFromEmailLink(): Promise<boolean> {
  const supabase = createClient();

  const hash = window.location.hash;
  if (hash && hash.includes("access_token")) {
    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      // Strip the tokens out of the visible URL/history now that they're
      // consumed.
      window.history.replaceState(null, "", window.location.pathname);
      return !error;
    }
  }

  const code = new URLSearchParams(window.location.search).get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }

  return false;
}
