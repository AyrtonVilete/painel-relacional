import { Users } from "lucide-react";
import { SimpleListSettingsPage } from "@/components/settings/simple-list-settings-page";
import {
  createClientRecord,
  deleteClientRecord,
  bulkCreateClientRecords,
} from "@/lib/clients/actions";

export const dynamic = "force-dynamic";

export default function ClientsPage() {
  return (
    <SimpleListSettingsPage
      table="clients"
      title="Clientes"
      description="Clientes que podem ser vinculados aos chamados."
      placeholder="Nome do cliente"
      emptyLabel="Nenhum cliente cadastrado ainda"
      icon={Users}
      itemLabel="o cliente"
      createAction={createClientRecord}
      deleteAction={deleteClientRecord}
      importAction={bulkCreateClientRecords}
      importLabel="Importar .txt"
    />
  );
}
