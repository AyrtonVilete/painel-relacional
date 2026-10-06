import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth/actions";
import { isAccessApproved } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function AguardandoAprovacaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  // Approved in the meantime: hand over to the single router for signed-in
  // people, which also creates the requested organization.
  if (isAccessApproved(user)) redirect("/acesso/continuar");

  return (
    <AuthShell
      headline="Seu acesso está em análise."
      description="Por segurança, cada novo acesso ao Painel Relacional é liberado manualmente por um administrador da plataforma."
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40">
          <ShieldCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Aguardando aprovação
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Recebemos o pedido de acesso de{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">{user.email}</span>.
          Assim que for aprovado, é só entrar de novo, ou tocar em verificar abaixo.
        </p>

        <div className="mt-6 flex w-full flex-col gap-2.5">
          <Link href="/aguardando-aprovacao">
            <Button type="button" className="w-full">
              Verificar aprovação
            </Button>
          </Link>
          <form action={logout}>
            <Button type="submit" variant="secondary" className="w-full">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}
