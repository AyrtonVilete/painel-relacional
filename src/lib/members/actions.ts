"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import type { ActionState } from "@/lib/actions/types";
import type { Database } from "@/types/database.types";

type MembershipRole = Database["public"]["Enums"]["membership_role"];

const inviteSchema = z.object({
  email: z.string().email("E-mail inválido").max(255),
  role: z.enum(["admin", "approver", "member"]),
});

export async function inviteMember(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "admin") {
    return { error: "Apenas administradores podem convidar membros" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Recorded before sending the invite: handle_new_user() grants membership
  // by matching this row's email, not from client-supplied auth metadata
  // (which anyone could set via Supabase's public signUp endpoint). See
  // migration 0013 for the full rationale.
  const { data: pendingInvite, error: inviteRowError } = await supabase
    .from("pending_invites")
    .insert({
      organization_id: membership.organization_id,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: user?.id,
    })
    .select("id")
    .single();

  if (inviteRowError || !pendingInvite) {
    return { error: "Não foi possível registrar o convite" };
  }

  // Surfaced in the invite email via the {{ .Data.* }} template variable
  // (Supabase populates it from this metadata) — lets the "Invite user"
  // template say who's inviting and to which org instead of a generic
  // "you've been invited" with no context.
  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/invite/set-password`,
      data: {
        inviter_name: inviterProfile?.full_name ?? "Um administrador",
        organization_name: membership.organizations?.name ?? "a organização",
      },
    }
  );

  if (error) {
    await supabase.from("pending_invites").delete().eq("id", pendingInvite.id);
    return {
      error: error.message.includes("already been registered")
        ? "Este e-mail já está cadastrado"
        : "Não foi possível enviar o convite",
    };
  }

  revalidatePath("/settings/members");
}

// The `memberships_prevent_last_admin_removal` DB trigger is the real
// authority here (covers any access path, not just this app). These
// pre-checks just avoid hitting that trigger's exception in the common
// case, for a cleaner no-op instead of a thrown error.
async function isLastAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  membershipId: string
) {
  const { data: target } = await supabase
    .from("memberships")
    .select("role, organization_id")
    .eq("id", membershipId)
    .maybeSingle();

  if (target?.role !== "admin") return false;

  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", target.organization_id)
    .eq("role", "admin");

  return (count ?? 0) <= 1;
}

export async function removeMember(membershipId: string) {
  const supabase = await createClient();

  if (await isLastAdmin(supabase, membershipId)) return;

  await supabase.from("memberships").delete().eq("id", membershipId);
  revalidatePath("/settings/members");
}

export async function updateMemberRole(
  membershipId: string,
  role: MembershipRole
) {
  const supabase = await createClient();

  if (role !== "admin" && (await isLastAdmin(supabase, membershipId))) {
    return;
  }

  await supabase
    .from("memberships")
    .update({ role })
    .eq("id", membershipId);
  revalidatePath("/settings/members");
}
