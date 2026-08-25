import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SimpleNameForm } from "@/components/settings/simple-name-form";
import { ImportTxtButton } from "@/components/settings/import-txt-button";
import { DeleteButton } from "@/components/settings/delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActionState } from "@/lib/actions/types";

// clients, ticket_types, and developers are structurally identical
// (id, name, organization_id, created_at) with the same RLS shape
// (org members view, org admins mutate) — this covers the "name-only
// org-scoped list" pattern shared by all three settings pages so a fix
// or a11y/style change only needs to happen once.
type SimpleNameTable = "clients" | "ticket_types" | "developers";

export async function SimpleListSettingsPage({
  table,
  title,
  description,
  placeholder,
  emptyLabel,
  icon: Icon,
  itemLabel,
  createAction,
  deleteAction,
  importAction,
  importLabel,
}: {
  table: SimpleNameTable;
  title: string;
  description: string;
  placeholder: string;
  emptyLabel: string;
  icon: LucideIcon;
  /** e.g. "o cliente", "o tipo de chamado" — used in the delete confirmation. */
  itemLabel: string;
  createAction: (
    prevState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  deleteAction: (id: string) => Promise<void>;
  /** Optional bulk-import-from-.txt action (one name per line). Only
   * clients uses this today — omit to leave a page single-add-only. */
  importAction?: (
    names: string[]
  ) => Promise<{ error?: string; importedCount?: number }>;
  importLabel?: string;
}) {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from(table)
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <SimpleNameForm
          action={createAction}
          placeholder={placeholder}
          submitLabel="Adicionar"
        />
        {importAction && (
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <ImportTxtButton action={importAction} label={importLabel ?? "Importar .txt"} />
          </div>
        )}
      </div>

      {items && items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 text-slate-800 dark:text-slate-200">
                    {item.name}
                  </td>
                  <td className="w-12 px-3 py-3 text-right">
                    <DeleteButton
                      action={deleteAction.bind(null, item.id)}
                      confirmMessage={`Excluir ${itemLabel} "${item.name}"? Essa ação não pode ser desfeita.`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Icon} label={emptyLabel} />
      )}
    </div>
  );
}
