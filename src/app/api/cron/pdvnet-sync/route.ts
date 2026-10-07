import { syncCompletionFromAdo } from "@/lib/pdvnet/completion";
import { syncExecutionDeadlinesFromAdo } from "@/lib/pdvnet/execution-deadlines";
import { linkAdoDataToTickets, syncPdvnetTickets } from "@/lib/pdvnet/sync";

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
    const syncResult = await syncPdvnetTickets();
    const linkResult = await linkAdoDataToTickets();
    // Runs after linkAdoDataToTickets on purpose: that one only fills an
    // empty execution_deadline (from Custom.CommitedDate); this one then
    // makes the DevOps forecast date (TargetDate) authoritative.
    const deadlines = await syncExecutionDeadlinesFromAdo();
    // Last, and isolated: it needs migration 0034, and until that is applied
    // it must not take the syncs above down with it.
    let completion: { concluded: number[]; error?: string };
    try {
      const result = await syncCompletionFromAdo();
      completion = { concluded: result.changes.map((c) => c.ticketNumber) };
    } catch (error) {
      console.error("[pdvnet-sync] completion step failed", error);
      completion = {
        concluded: [],
        error: error instanceof Error ? error.message : "unknown error",
      };
    }
    return Response.json({
      ok: true,
      ...syncResult,
      ...linkResult,
      deadlinesChecked: deadlines.checked,
      deadlinesMatched: deadlines.matched,
      deadlinesUpdated: deadlines.changes.length,
      concluded: completion.concluded,
      ...(completion.error ? { completionError: completion.error } : {}),
    });
  } catch (error) {
    console.error("[pdvnet-sync] failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
