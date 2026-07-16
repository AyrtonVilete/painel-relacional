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
  email: z.string().email("E-mail inválido"),
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

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        organization_id: membership.organization_id,
        role: parsed.data.role,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/invite/set-password`,
    }
  );

  if (error) {
    return {
      error: error.message.includes("already been registered")
        ? "Este e-mail já está cadastrado"
        : "Não foi possível enviar o convite",
    };
  }

  revalidatePath("/settings/members");
}

export async function removeMember(membershipId: string) {
  const supabase = await createClient();
  await supabase.from("memberships").delete().eq("id", membershipId);
  revalidatePath("/settings/members");
}

export async function updateMemberRole(
  membershipId: string,
  role: MembershipRole
) {
  const supabase = await createClient();
  await supabase
    .from("memberships")
    .update({ role })
    .eq("id", membershipId);
  revalidatePath("/settings/members");
}
