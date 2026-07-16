"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import type { ActionState } from "@/lib/actions/types";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" isLoading={pending}>
      {!pending && <Plus className="h-4 w-4" aria-hidden />}
      {label}
    </Button>
  );
}

export function SimpleNameForm({
  action,
  placeholder,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  placeholder: string;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <ErrorAlert>{state.error}</ErrorAlert>}
      <div className="flex items-center gap-3">
        <Input
          name="name"
          placeholder={placeholder}
          required
          className="max-w-xs"
        />
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
