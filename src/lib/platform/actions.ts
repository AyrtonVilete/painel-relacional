"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/auth/access";

const userIdSchema = z.string().uuid();

// Every action re-checks who is calling, from the live session on the
// server. The page being hidden from non-admins is only cosmetic: these are
// reachable by anyone who can craft a request, so they enforce it themselves.
async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isPlatformAdmin(user) ? user : null;
}

async function loadTarget(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  return { admin, target: error ? null : data.user };
}

// A ban is how "revoked" is made to stick: it also stops the person from
// refreshing their session, so they can't just keep going on a long-lived one.
const BAN_FOREVER = "876000h";

export async function approveAccess(userId: string): Promise<{ error?: string }> {
  const caller = await requirePlatformAdmin();
  if (!caller) return { error: "Sem permissão" };
  if (!userIdSchema.safeParse(userId).success) return { error: "Usuário inválido" };

  const { admin, target } = await loadTarget(userId);
  if (!target) return { error: "Usuário não encontrado" };

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
    app_metadata: {
      access_approved: true,
      approved_via: "platform",
      approved_by: caller.id,
      approved_at: new Date().toISOString(),
      revoked_at: null,
    },
  });
  if (error) return { error: "Não foi possível aprovar" };

  revalidatePath("/plataforma");
  return {};
}

// Refuses a request: the account is deleted outright (it was never used).
export async function rejectAccess(userId: string): Promise<{ error?: string }> {
  const caller = await requirePlatformAdmin();
  if (!caller) return { error: "Sem permissão" };
  if (!userIdSchema.safeParse(userId).success) return { error: "Usuário inválido" };

  const { admin, target } = await loadTarget(userId);
  if (!target) return { error: "Usuário não encontrado" };
  if (target.id === caller.id || isPlatformAdmin(target)) {
    return { error: "Esta conta não pode ser removida aqui" };
  }
  // Deleting someone who already has access would destroy their work; that
  // goes through "Revogar", which is reversible.
  if (target.app_metadata?.access_approved === true) {
    return { error: "Esta conta já tem acesso. Use Revogar acesso." };
  }
  // Only real Painel signup requests can be deleted. Accounts without the
  // organization typed at signup belong to something else sharing this login
  // (the finance app), and removing them here would destroy them there.
  if (!(target.user_metadata as { org_slug?: string } | undefined)?.org_slug) {
    return { error: "Esta conta não veio de um pedido de acesso e não pode ser apagada aqui." };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: "Não foi possível recusar" };

  revalidatePath("/plataforma");
  return {};
}

// Takes access away without deleting anything, and can be undone with Aprovar.
export async function revokeAccess(userId: string): Promise<{ error?: string }> {
  const caller = await requirePlatformAdmin();
  if (!caller) return { error: "Sem permissão" };
  if (!userIdSchema.safeParse(userId).success) return { error: "Usuário inválido" };

  const { admin, target } = await loadTarget(userId);
  if (!target) return { error: "Usuário não encontrado" };
  if (target.id === caller.id || isPlatformAdmin(target)) {
    return { error: "Esta conta não pode ser revogada aqui" };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_FOREVER,
    app_metadata: {
      access_approved: false,
      revoked_by: caller.id,
      revoked_at: new Date().toISOString(),
    },
  });
  if (error) return { error: "Não foi possível revogar" };

  revalidatePath("/plataforma");
  return {};
}
