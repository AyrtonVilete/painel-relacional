import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Service-role client: bypasses RLS entirely. Never import this from
// client components or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// Used only for admin-only operations such as inviting members by email.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        // Same reasoning as src/lib/supabase/server.ts: Next.js patches
        // global fetch and can cache a Supabase REST response across
        // invocations of the same route (confirmed live — a second
        // linkAdoDataToTickets() call in the same dev-server process read
        // a stale pre-update `tickets` row, causing a duplicate developer
        // and a redundant write). This client reads fresh, mutation-driving
        // data every time, so it must never be served from Next's cache.
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
