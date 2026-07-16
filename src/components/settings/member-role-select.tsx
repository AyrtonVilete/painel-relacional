"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/select";
import { updateMemberRole } from "@/lib/members/actions";
import type { Database } from "@/types/database.types";

type MembershipRole = Database["public"]["Enums"]["membership_role"];

export function MemberRoleSelect({
  membershipId,
  currentRole,
  disabled,
}: {
  membershipId: string;
  currentRole: MembershipRole;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={currentRole}
      disabled={disabled || isPending}
      onChange={(e) => {
        const role = e.target.value as MembershipRole;
        startTransition(() => {
          updateMemberRole(membershipId, role);
        });
      }}
      className="w-36"
    >
      <option value="member">Membro</option>
      <option value="approver">Aprovador</option>
      <option value="admin">Admin</option>
    </Select>
  );
}
