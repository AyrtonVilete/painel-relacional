import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ConfirmarEmailPage() {
  return (
    <AuthShell
      headline="Quase lá."
      description="Assim que você confirmar o e-mail, sua organização é criada automaticamente e você já pode começar a usar o painel."
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40">
          <MailCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Confirme seu e-mail
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Enviamos um link de confirmação para o e-mail informado. Abra-o
          para ativar sua conta e finalizar a criação da organização.
        </p>
      </div>
    </AuthShell>
  );
}
