"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyAccessRequest } from "@/lib/platform/notify-access-request";

export type ActionState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe a senha").max(200),
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

  // Routes by approval status (and creates the organization of someone
  // approved who has never logged in since).
  redirect("/acesso/continuar");
}

const signupSchema = z.object({
  fullName: z.string().min(1, "Informe seu nome").max(200),
  orgName: z.string().min(2, "Informe o nome da organização").max(200),
  email: z.string().email("E-mail inválido").max(255),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(200),
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

  await notifyAccessRequest({ fullName, orgName, email });

  // The organization is NOT created here anymore: nothing exists for this
  // person until a platform admin approves them in /plataforma, and
  // /acesso/continuar creates it at that point. A session only comes back
  // when this project has email confirmation off; either way they land on a
  // screen that says the access is pending.
  redirect(data.session ? "/aguardando-aprovacao" : "/signup/confirmar-email");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
