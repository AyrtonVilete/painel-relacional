"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { createSprint } from "@/lib/sprints/actions";
import type { ActionState } from "@/lib/actions/types";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" isLoading={pending}>
      {!pending && <Plus className="h-4 w-4" aria-hidden />}
      Adicionar sprint
    </Button>
  );
}

export function SprintForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(
    createSprint,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <ErrorAlert>{state.error}</ErrorAlert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" placeholder="Sprint 1" required />
        </div>
        <div>
          <Label htmlFor="startDate">Início</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        <div>
          <Label htmlFor="endDate">Fim</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
