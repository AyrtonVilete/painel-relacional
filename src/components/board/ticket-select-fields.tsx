"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Tables } from "@/types/database.types";

// Small option-list wrappers shared by create-ticket-dialog.tsx and
// ticket-detail-dialog.tsx — the two dialogs lay these fields out in
// different groupings/order, but the <Select>+options markup for each
// reference list was byte-for-byte duplicated between them.

export function ClientSelect({
  clients,
  defaultValue,
}: {
  clients: Tables<"clients">[];
  defaultValue?: string | null;
}) {
  return (
    <div>
      <Label htmlFor="clientId">Cliente</Label>
      <Select id="clientId" name="clientId" defaultValue={defaultValue ?? ""}>
        <option value="">Nenhum</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function TypeSelect({
  ticketTypes,
  defaultValue,
}: {
  ticketTypes: Tables<"ticket_types">[];
  defaultValue?: string | null;
}) {
  return (
    <div>
      <Label htmlFor="typeId">Tipo</Label>
      <Select id="typeId" name="typeId" defaultValue={defaultValue ?? ""}>
        <option value="">Nenhum</option>
        {ticketTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function SprintSelect({
  sprints,
  defaultValue,
}: {
  sprints: Tables<"sprints">[];
  defaultValue?: string | null;
}) {
  return (
    <div>
      <Label htmlFor="sprintId">Sprint</Label>
      <Select id="sprintId" name="sprintId" defaultValue={defaultValue ?? ""}>
        <option value="">Nenhuma</option>
        {sprints.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function DeveloperSelect({
  developers,
  defaultValue,
}: {
  developers: { id: string; name: string }[];
  defaultValue?: string | null;
}) {
  return (
    <div>
      <Label htmlFor="developerId">Desenvolvedor</Label>
      <Select id="developerId" name="developerId" defaultValue={defaultValue ?? ""}>
        <option value="">Nenhum</option>
        {developers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
