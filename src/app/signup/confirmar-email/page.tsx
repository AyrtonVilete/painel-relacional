import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ConfirmarEmailPage() {
  return (
    <AuthShell
      headline="Quase lá."
      description="Confirme o e-mail para concluir o pedido. O acesso só é liberado depois que um administrador da plataforma aprovar."
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40">
          <MailCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Confirme seu e-mail
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Enviamos um link de confirmação para o e-mail informado. Depois de
          confirmar, seu pedido segue para aprovação e você é avisado ao
          entrar.
        </p>
      </div>
    </AuthShell>
  );
}
