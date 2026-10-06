"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveAccess, rejectAccess, revokeAccess } from "@/lib/platform/actions";

// "other" is an account that didn't come from the Painel signup (e.g. another
// app sharing this login): it can be let in, but never deleted from here.
type Kind = "pending" | "approved" | "blocked" | "other";

// Recusar and Revogar are two clicks on purpose: the first only arms the
// button, so a stray tap can't delete a request or lock someone out.
export function AccessActions({ userId, kind }: { userId: string; kind: Kind }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"reject" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(userId);
      if (result.error) setError(result.error);
      setConfirming(null);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {(kind === "pending" || kind === "blocked" || kind === "other") && (
          <Button type="button" isLoading={isPending && confirming === null} onClick={() => run(approveAccess)}>
            {kind === "blocked" ? "Aprovar de novo" : "Aprovar"}
          </Button>
        )}

        {kind === "pending" &&
          (confirming === "reject" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                isLoading={isPending}
                onClick={() => run(rejectAccess)}
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Confirmar recusa
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirming(null)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setConfirming("reject")}>
              Recusar
            </Button>
          ))}

        {kind === "approved" &&
          (confirming === "revoke" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                isLoading={isPending}
                onClick={() => run(revokeAccess)}
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Confirmar revogação
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirming(null)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setConfirming("revoke")}>
              Revogar acesso
            </Button>
          ))}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
