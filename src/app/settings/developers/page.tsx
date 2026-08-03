import { Code2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createDeveloper, deleteDeveloper } from "@/lib/developers/actions";
import { SimpleNameForm } from "@/components/settings/simple-name-form";
import { DeleteButton } from "@/components/settings/delete-button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const supabase = await createClient();

  const { data: developers } = await supabase
    .from("developers")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Desenvolvedores
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Lista de desenvolvedores usada para atribuir e filtrar chamados no
          quadro.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <SimpleNameForm
          action={createDeveloper}
          placeholder="Nome do desenvolvedor"
          submitLabel="Adicionar"
        />
      </div>

      {developers && developers.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {developers.map((developer) => (
                <tr key={developer.id}>
                  <td className="px-5 py-3 text-slate-800 dark:text-slate-200">
                    {developer.name}
                  </td>
                  <td className="w-12 px-3 py-3 text-right">
                    <DeleteButton
                      action={deleteDeveloper.bind(null, developer.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Code2} label="Nenhum desenvolvedor cadastrado ainda" />
      )}
    </div>
  );
}
