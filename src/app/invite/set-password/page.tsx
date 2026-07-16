import { AuthShell } from "@/components/auth/auth-shell";
import { InviteAcceptGate } from "@/components/auth/invite-accept-gate";

export default function SetPasswordPage() {
  return (
    <AuthShell
      headline="Você foi convidado para uma organização no Painel Relacional."
      description="Defina sua senha para começar a acompanhar os chamados da sua equipe."
    >
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Complete seu cadastro
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Defina uma senha para acessar sua conta
        </p>
      </div>

      <InviteAcceptGate />
    </AuthShell>
  );
}
