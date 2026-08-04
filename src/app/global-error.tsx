"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Algo deu errado</h1>
          <p className="mt-2 text-sm text-slate-600">
            O erro foi registrado. Tente recarregar a página.
          </p>
        </div>
      </body>
    </html>
  );
}
