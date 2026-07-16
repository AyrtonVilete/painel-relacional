"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { login, type ActionState } from "@/lib/auth/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/alert";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" isLoading={pending} className="w-full">
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<ActionState, FormData>(
    login,
    undefined
  );

  return (
    <AuthShell
      headline="Organize chamados, sugestões e prioridades em um só lugar."
      description="Um quadro kanban feito para equipes de relacionamento acompanharem tudo o que importa, com histórico completo de cada movimentação."
    >
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Bem-vindo de volta
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Entre com sua conta para acessar o painel
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {state?.error && <ErrorAlert>{state.error}</ErrorAlert>}

        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            required
          />
        </div>

        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </div>

        <SubmitButton />
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Não tem uma conta?{" "}
        <Link
          href="/signup"
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Criar organização
        </Link>
      </p>
    </AuthShell>
  );
}
