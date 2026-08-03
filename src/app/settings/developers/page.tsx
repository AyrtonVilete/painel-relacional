import { Code2 } from "lucide-react";
import { SimpleListSettingsPage } from "@/components/settings/simple-list-settings-page";
import { createDeveloper, deleteDeveloper } from "@/lib/developers/actions";

export const dynamic = "force-dynamic";

export default function DevelopersPage() {
  return (
    <SimpleListSettingsPage
      table="developers"
      title="Desenvolvedores"
      description="Lista de desenvolvedores usada para atribuir e filtrar chamados no quadro."
      placeholder="Nome do desenvolvedor"
      emptyLabel="Nenhum desenvolvedor cadastrado ainda"
      icon={Code2}
      itemLabel="o desenvolvedor"
      createAction={createDeveloper}
      deleteAction={deleteDeveloper}
    />
  );
}
