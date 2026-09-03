import { syncPdvnetTickets } from "@/lib/pdvnet/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically to
// routes invoked by a cron schedule once CRON_SECRET is set — this is the
// standard way to keep an otherwise-public route from being triggered by
// anyone who finds the URL, same purpose as verifyWebhookSecret elsewhere.
function isAuthorized(request: Request) {
  const auth = request.headers.get("authorization");
  return Boolean(process.env.CRON_SECRET) && auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await syncPdvnetTickets();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[pdvnet-sync] failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
