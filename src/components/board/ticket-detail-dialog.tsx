"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

type HistoryRow = Tables<"ticket_history">;

export function TicketDetailDialog({
  ticket,
  onClose,
  statuses,
  sprints,
  clients,
  ticketTypes,
  membersById,
  developers,
  canApprove,
  isAdmin,
  onUpdated,
  onDeleted,
}: {
  ticket: Tables<"tickets">;
  onClose: () => void;
  statuses: Tables<"statuses">[];
  sprints: Tables<"sprints">[];
  clients: Tables<"clients">[];
  ticketTypes: Tables<"ticket_types">[];
  membersById: Map<string, string>;
  developers: { id: string; name: string }[];
  canApprove: boolean;
  isAdmin: boolean;
  onUpdated: (ticket: Tables<"tickets">) => void;
  onDeleted: (ticketId: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  const statusesById = new Map(statuses.map((s) => [s.id, s.name]));
  const sprintsById = new Map(sprints.map((s) => [s.id, s.name]));

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("ticket_history")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("moved_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setHistory(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [ticket.id]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") ?? "").trim();

    if (!title) {
      setError("Informe um título");
      return;
    }

    const ticketNumberRaw = String(formData.get("ticketNumber") ?? "").trim();
    const ticketNumber = Number(ticketNumberRaw);

    if (!ticketNumberRaw || !Number.isInteger(ticketNumber) || ticketNumber <= 0) {
      setError("Informe o número do chamado");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    const newStatusId = String(formData.get("statusId") ?? ticket.status_id);
    const sprintValue = String(formData.get("sprintId") ?? "");
    const newSprintId = sprintValue || null;
    const statusChanged = newStatusId !== ticket.status_id;
    const sprintChanged = newSprintId !== ticket.sprint_id;

    if (statusChanged || sprintChanged) {
      const { error: moveError } = await supabase.rpc("move_ticket", {
        p_ticket_id: ticket.id,
        p_new_status_id: statusChanged ? newStatusId : undefined,
        p_new_sprint_id: sprintChanged ? newSprintId ?? undefined : undefined,
        p_sprint_explicitly_set: sprintChanged,
      });

      if (moveError) {
        setError("Não foi possível mover o chamado");
        setIsSaving(false);
        return;
      }
    }

    const clientValue = String(formData.get("clientId") ?? "");
    const typeValue = String(formData.get("typeId") ?? "");
    const developerValue = String(formData.get("developerId") ?? "");
    const deadlineValue = String(formData.get("deadline") ?? "");
    const description = String(formData.get("description") ?? "").trim();

    const { data, error: updateError } = await supabase
      .from("tickets")
      .update({
        title,
        ticket_number: ticketNumber,
        description: description || null,
        urgency: formData.get("urgency") as Tables<"tickets">["urgency"],
        client_id: clientValue || null,
        type_id: typeValue || null,
        developer_id: developerValue || null,
        deadline: deadlineValue || null,
        status_id: newStatusId,
        sprint_id: newSprintId,
      })
      .eq("id", ticket.id)
      .select()
      .single();

    setIsSaving(false);

    if (updateError || !data) {
      setError(
        updateError?.code === "23505"
          ? "Já existe um chamado com esse número"
          : "Não foi possível salvar as alterações"
      );
      return;
    }

    onUpdated(data);
    onClose();
  }

  async function handleApprove() {
    setIsApproving(true);
    const supabase = createClient();
    const { data, error: approveError } = await supabase
      .from("tickets")
      .update({ approved: true })
      .eq("id", ticket.id)
      .select()
      .single();

    setIsApproving(false);

    if (approveError || !data) {
      setError("Não foi possível aprovar o chamado");
      return;
    }

    onUpdated(data);
  }

  async function handleDelete() {
    if (!window.confirm("Excluir este chamado? Essa ação não pode ser desfeita.")) {
      return;
    }

    setIsDeleting(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("tickets")
      .delete()
      .eq("id", ticket.id);

    setIsDeleting(false);

    if (deleteError) {
      setError("Não foi possível excluir o chamado");
      return;
    }

    onDeleted(ticket.id);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Chamado #${ticket.ticket_number}`}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div className="flex items-center justify-between gap-3">
          {ticket.approved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Aprovado
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Pendente de aprovação
            </span>
          )}

          <div className="flex items-center gap-2">
            {!ticket.approved && canApprove && (
              <Button
                type="button"
                variant="secondary"
                isLoading={isApproving}
                onClick={handleApprove}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Aprovar
              </Button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label="Excluir chamado"
                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>

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
              defaultValue={ticket.ticket_number}
            />
          </div>
          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              name="title"
              defaultValue={ticket.title}
              required
              maxLength={200}
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
            defaultValue={ticket.description ?? ""}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="statusId">Status</Label>
            <Select id="statusId" name="statusId" defaultValue={ticket.status_id}>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="urgency">Urgência</Label>
            <Select id="urgency" name="urgency" defaultValue={ticket.urgency}>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="clientId">Cliente</Label>
            <Select id="clientId" name="clientId" defaultValue={ticket.client_id ?? ""}>
              <option value="">Nenhum</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="typeId">Tipo</Label>
            <Select id="typeId" name="typeId" defaultValue={ticket.type_id ?? ""}>
              <option value="">Nenhum</option>
              {ticketTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sprintId">Sprint</Label>
            <Select id="sprintId" name="sprintId" defaultValue={ticket.sprint_id ?? ""}>
              <option value="">Nenhuma</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="deadline">Prazo</Label>
            <Input
              id="deadline"
              name="deadline"
              type="date"
              defaultValue={ticket.deadline ?? ""}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="developerId">Desenvolvedor</Label>
          <Select
            id="developerId"
            name="developerId"
            defaultValue={ticket.developer_id ?? ""}
          >
            <option value="">Nenhum</option>
            {developers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Salvar alterações
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Histórico
        </h3>

        {history === null ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Nenhuma movimentação registrada ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.map((entry) => (
              <li key={entry.id} className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {membersById.get(entry.moved_by) ?? "Alguém"}
                </span>{" "}
                {entry.from_status_id !== entry.to_status_id && (
                  <>
                    moveu de{" "}
                    <span className="font-medium">
                      {entry.from_status_id
                        ? statusesById.get(entry.from_status_id) ?? "—"
                        : "—"}
                    </span>{" "}
                    para{" "}
                    <span className="font-medium">
                      {entry.to_status_id
                        ? statusesById.get(entry.to_status_id) ?? "—"
                        : "—"}
                    </span>
                  </>
                )}
                {entry.from_sprint_id !== entry.to_sprint_id && (
                  <>
                    {entry.from_status_id !== entry.to_status_id ? " e " : "alterou a sprint "}
                    de{" "}
                    <span className="font-medium">
                      {entry.from_sprint_id
                        ? sprintsById.get(entry.from_sprint_id) ?? "—"
                        : "nenhuma"}
                    </span>{" "}
                    para{" "}
                    <span className="font-medium">
                      {entry.to_sprint_id
                        ? sprintsById.get(entry.to_sprint_id) ?? "—"
                        : "nenhuma"}
                    </span>
                  </>
                )}
                <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                  {new Date(entry.moved_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
