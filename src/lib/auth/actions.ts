"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export async function login(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "E-mail ou senha incorretos" };
  }

  redirect("/board");
}

const signupSchema = z.object({
  fullName: z.string().min(1, "Informe seu nome"),
  orgName: z.string().min(2, "Informe o nome da organização"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function signup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    orgName: formData.get("orgName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { fullName, orgName, email, password } = parsed.data;
  const baseSlug = slugify(orgName) || "org";
  const orgSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, org_name: orgName, org_slug: orgSlug },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return {
      error:
        error.message === "User already registered"
          ? "Já existe uma conta com esse e-mail"
          : "Não foi possível criar a conta. Tente novamente.",
    };
  }

  if (data.session) {
    // Email confirmation is disabled on this project — session is already
    // active, so bootstrap the organization right away instead of waiting
    // for /auth/callback (which only fires on the confirmation-link flow).
    const { error: rpcError } = await supabase.rpc(
      "create_organization_with_admin",
      { org_name: orgName, org_slug: orgSlug }
    );

    if (rpcError) {
      return {
        error: "Conta criada, mas houve um erro ao configurar a organização.",
      };
    }

    redirect("/board");
  }

  redirect("/signup/confirmar-email");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
