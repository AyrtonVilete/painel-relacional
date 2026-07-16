import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createClientRecord, deleteClientRecord } from "@/lib/clients/actions";
import { SimpleNameForm } from "@/components/settings/simple-name-form";
import { DeleteButton } from "@/components/settings/delete-button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Clientes que podem ser vinculados aos chamados.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <SimpleNameForm
          action={createClientRecord}
          placeholder="Nome do cliente"
          submitLabel="Adicionar"
        />
      </div>

      {clients && clients.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="px-5 py-3 text-slate-800 dark:text-slate-200">
                    {client.name}
                  </td>
                  <td className="w-12 px-3 py-3 text-right">
                    <DeleteButton
                      action={deleteClientRecord.bind(null, client.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Users} label="Nenhum cliente cadastrado ainda" />
      )}
    </div>
  );
}
