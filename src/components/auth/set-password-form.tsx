"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";

export function SetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    const {
      data: { user },
      error: updateError,
    } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName },
    });

    if (updateError || !user) {
      setError("Não foi possível concluir o cadastro. Tente novamente.");
      setIsSubmitting(false);
      return;
    }

    if (fullName) {
      await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    }

    router.push("/board");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div>
        <Label htmlFor="fullName">Seu nome</Label>
        <Input id="fullName" name="fullName" placeholder="Maria Silva" required />
      </div>

      <div>
        <Label htmlFor="password">Crie uma senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
          Mínimo de 8 caracteres
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirme a senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <Button type="submit" isLoading={isSubmitting} className="w-full">
        Entrar no painel
      </Button>
    </form>
  );
}
