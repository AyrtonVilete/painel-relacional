import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

// Use inside Server Components, Server Actions, and Route Handlers.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component during render, where cookies
            // can't be set. Safe to ignore because middleware refreshes
            // the session on every request.
          }
        },
      },
      global: {
        // Belt-and-suspenders alongside `export const dynamic =
        // "force-dynamic"` on every page that reads per-user data: Next.js
        // patches global fetch and can otherwise cache a Supabase REST
        // response keyed without regard to the caller's auth cookie,
        // serving one user's data to another on the same route. Force
        // every request through this client to bypass Next's fetch cache
        // entirely, regardless of route-level config.
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
