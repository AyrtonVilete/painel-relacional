"use client";

import { useEffect, useState } from "react";
import { establishSessionFromEmailLink } from "@/lib/auth/establish-session-from-link";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export function InviteAcceptGate() {
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">(
    "checking"
  );

  useEffect(() => {
    establishSessionFromEmailLink().then((ok) => {
      setStatus(ok ? "valid" : "invalid");
    });
  }, []);

  if (status === "checking") {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">
        Verificando convite...
      </p>
    );
  }

  if (status === "invalid") {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Este link de convite é inválido ou expirou. Peça um novo convite ao
        administrador da sua organização.
      </p>
    );
  }

  return <SetPasswordForm />;
}
