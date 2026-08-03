"use client";

import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

function DeleteSubmit({
  onClick,
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={onClick}
      aria-label="Excluir"
      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}

export function DeleteButton({
  action,
  confirmMessage = "Excluir este item? Essa ação não pode ser desfeita.",
}: {
  action: () => Promise<void>;
  confirmMessage?: string;
}) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(confirmMessage)) {
      e.preventDefault();
    }
  }

  return (
    <form action={action}>
      <DeleteSubmit onClick={handleClick} />
    </form>
  );
}
