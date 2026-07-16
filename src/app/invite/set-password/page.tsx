import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const supabase = await createClient();
  let valid = false;

  if (searchParams.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      searchParams.code
    );
    valid = !error;
  }

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

      {valid ? (
        <SetPasswordForm />
      ) : (
        <p className="text-sm text-red-600 dark:text-red-400">
          Este link de convite é inválido ou expirou. Peça um novo convite ao
          administrador da sua organização.
        </p>
      )}
    </AuthShell>
  );
}
