import { Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createTicketType, deleteTicketType } from "@/lib/ticket-types/actions";
import { SimpleNameForm } from "@/components/settings/simple-name-form";
import { DeleteButton } from "@/components/settings/delete-button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function TicketTypesPage() {
  const supabase = await createClient();

  const { data: ticketTypes } = await supabase
    .from("ticket_types")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Tipos de chamado
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Categorias usadas para classificar cada chamado (ex.: Problema,
          Sugestão).
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <SimpleNameForm
          action={createTicketType}
          placeholder="Nome do tipo de chamado"
          submitLabel="Adicionar"
        />
      </div>

      {ticketTypes && ticketTypes.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {ticketTypes.map((type) => (
                <tr key={type.id}>
                  <td className="px-5 py-3 text-slate-800 dark:text-slate-200">
                    {type.name}
                  </td>
                  <td className="w-12 px-3 py-3 text-right">
                    <DeleteButton
                      action={deleteTicketType.bind(null, type.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Tag} label="Nenhum tipo de chamado cadastrado ainda" />
      )}
    </div>
  );
}
