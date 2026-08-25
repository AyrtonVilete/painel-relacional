"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { inviteMember } from "@/lib/members/actions";
import { useResetFormOnSuccess } from "@/lib/utils/use-reset-form-on-success";
import type { ActionState } from "@/lib/actions/types";

function SubmitButton({
  formRef,
  hasError,
}: {
  formRef: React.RefObject<HTMLFormElement>;
  hasError: boolean;
}) {
  const { pending } = useFormStatus();
  useResetFormOnSuccess(formRef, pending, hasError);

  return (
    <Button type="submit" isLoading={pending}>
      {!pending && <UserPlus className="h-4 w-4" aria-hidden />}
      Enviar convite
    </Button>
  );
}

export function InviteMemberForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(
    inviteMember,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state?.error && <ErrorAlert>{state.error}</ErrorAlert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="pessoa@empresa.com"
          />
        </div>
        <div>
          <Label htmlFor="role">Papel</Label>
          <Select id="role" name="role" defaultValue="member">
            <option value="member">Membro</option>
            <option value="approver">Aprovador</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
      </div>

      <SubmitButton formRef={formRef} hasError={!!state?.error} />
    </form>
  );
}
