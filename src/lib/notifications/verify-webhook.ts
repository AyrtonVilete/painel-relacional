import "server-only";

// Verifies the shared secret the Supabase trigger sends via pg_net so this
// publicly-reachable route can't be spammed by an arbitrary POST.
export function verifyWebhookSecret(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  return Boolean(secret) && secret === process.env.SUPABASE_WEBHOOK_SECRET;
}
