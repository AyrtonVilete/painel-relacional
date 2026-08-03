import { Tag } from "lucide-react";
import { SimpleListSettingsPage } from "@/components/settings/simple-list-settings-page";
import { createTicketType, deleteTicketType } from "@/lib/ticket-types/actions";

export const dynamic = "force-dynamic";

export default function TicketTypesPage() {
  return (
    <SimpleListSettingsPage
      table="ticket_types"
      title="Tipos de chamado"
      description="Categorias usadas para classificar cada chamado (ex.: Problema, Sugestão)."
      placeholder="Nome do tipo de chamado"
      emptyLabel="Nenhum tipo de chamado cadastrado ainda"
      icon={Tag}
      itemLabel="o tipo de chamado"
      createAction={createTicketType}
      deleteAction={deleteTicketType}
    />
  );
}
