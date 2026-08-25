"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import {
  ClientSelect,
  TypeSelect,
  SprintSelect,
  DeveloperSelect,
  RequesterSelect,
} from "@/components/board/ticket-select-fields";
import { createClient } from "@/lib/supabase/client";
import { parseTicketFormFields } from "@/lib/tickets/parse-ticket-form";
import type { Tables } from "@/types/database.types";

export function CreateTicketDialog({
  open,
  onClose,
  statusId,
  organizationId,
  boardId,
  clients,
  ticketTypes,
  sprints,
  developers,
  members,
  currentUserId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  statusId: string;
  organizationId: string;
  boardId: string;
  clients: Tables<"clients">[];
  ticketTypes: Tables<"ticket_types">[];
  sprints: Tables<"sprints">[];
  developers: { id: string; name: string }[];
  members: { id: string; name: string }[];
  currentUserId: string;
  onCreated: (ticket: Tables<"tickets">) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const { title, ticketNumber, error: validationError } =
      parseTicketFormFields(formData);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada, faça login novamente");
      setIsSubmitting(false);
      return;
    }

    const clientId = String(formData.get("clientId") ?? "");
    const typeId = String(formData.get("typeId") ?? "");
    const sprintId = String(formData.get("sprintId") ?? "");
    const developerId = String(formData.get("developerId") ?? "");
    const deadline = String(formData.get("deadline") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const requesterId = String(formData.get("requesterId") ?? "") || user.id;

    const { data, error: insertError } = await supabase
      .from("tickets")
      .insert({
        organization_id: organizationId,
        board_id: boardId,
        status_id: statusId,
        title,
        ticket_number: ticketNumber,
        description: description || null,
        urgency: formData.get("urgency") as Tables<"tickets">["urgency"],
        client_id: clientId || null,
        type_id: typeId || null,
        sprint_id: sprintId || null,
        developer_id: developerId || null,
        deadline: deadline || null,
        created_by: requesterId,
      })
      .select()
      .single();

    setIsSubmitting(false);

    if (insertError || !data) {
      setError(
        insertError?.code === "23505"
          ? "Já existe um chamado com esse número"
          : "Não foi possível criar o chamado"
      );
      return;
    }

    onCreated(data);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Novo chamado">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ticketNumber">Número do chamado</Label>
            <Input
              id="ticketNumber"
              name="ticketNumber"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              placeholder="Ex: 1029"
            />
          </div>
          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              placeholder="Descreva o chamado"
              autoFocus
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            maxLength={4000}
            placeholder="Detalhes adicionais (opcional)"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="urgency">Urgência</Label>
            <Select id="urgency" name="urgency" defaultValue="medium">
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="deadline">Prazo</Label>
            <Input id="deadline" name="deadline" type="date" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ClientSelect clients={clients} />
          <TypeSelect ticketTypes={ticketTypes} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {sprints.length > 0 && <SprintSelect sprints={sprints} />}
          <DeveloperSelect developers={developers} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <RequesterSelect members={members} defaultValue={currentUserId} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Criar chamado
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
