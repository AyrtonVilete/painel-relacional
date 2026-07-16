import { CalendarRange } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteSprint } from "@/lib/sprints/actions";
import { SprintForm } from "@/components/settings/sprint-form";
import { DeleteButton } from "@/components/settings/delete-button";
import { EmptyState } from "@/components/ui/empty-state";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default async function SprintsPage() {
  const supabase = await createClient();

  const { data: sprints } = await supabase
    .from("sprints")
    .select("id, name, start_date, end_date")
    .order("start_date", { ascending: true, nullsFirst: false });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Sprints
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Períodos de trabalho usados para agrupar chamados no quadro.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <SprintForm />
      </div>

      {sprints && sprints.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {sprints.map((sprint) => (
                <tr key={sprint.id}>
                  <td className="px-5 py-3 text-slate-800 dark:text-slate-200">
                    {sprint.name}
                  </td>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                    {sprint.start_date ? formatDate(sprint.start_date) : "—"}
                    {" – "}
                    {sprint.end_date ? formatDate(sprint.end_date) : "—"}
                  </td>
                  <td className="w-12 px-3 py-3 text-right">
                    <DeleteButton action={deleteSprint.bind(null, sprint.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={CalendarRange} label="Nenhuma sprint cadastrada ainda" />
      )}
    </div>
  );
}
