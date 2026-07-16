"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signup, type ActionState } from "@/lib/auth/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/alert";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" isLoading={pending} className="w-full">
      {pending ? "Criando conta..." : "Criar organização"}
    </Button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState<ActionState, FormData>(
    signup,
    undefined
  );

  return (
    <AuthShell
      headline="Crie a organização da sua equipe em menos de um minuto."
      description="Você começa como administrador, com um quadro inicial já configurado e pronto para receber os primeiros chamados."
    >
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Criar organização
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Você será o administrador da sua organização
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {state?.error && <ErrorAlert>{state.error}</ErrorAlert>}

        <div>
          <Label htmlFor="fullName">Seu nome</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Maria Silva"
            required
          />
        </div>

        <div>
          <Label htmlFor="orgName">Nome da organização</Label>
          <Input
            id="orgName"
            name="orgName"
            type="text"
            placeholder="Minha Empresa"
            required
          />
        </div>

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
            autoComplete="new-password"
            placeholder="••••••••"
            minLength={8}
            required
          />
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">Mínimo de 8 caracteres</p>
        </div>

        <SubmitButton />
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Já tem uma conta?{" "}
        <Link
          href="/login"
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
