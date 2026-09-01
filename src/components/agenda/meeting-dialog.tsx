"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { createMeeting, updateMeeting, deleteMeeting } from "@/lib/meetings/actions";
import type { Tables } from "@/types/database.types";

export function MeetingDialog({
  open,
  onClose,
  initialDate,
  meeting,
  canManage,
}: {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
  meeting?: Tables<"meetings">;
  canManage: boolean;
}) {
  const isEditing = !!meeting;
  const readOnly = isEditing && !canManage;

  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [date, setDate] = useState(meeting?.meeting_date ?? initialDate ?? "");
  const [startTime, setStartTime] = useState(meeting?.start_time.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(meeting?.end_time?.slice(0, 5) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const input = {
      title,
      description: description.trim() || undefined,
      meetingDate: date,
      startTime,
      endTime: endTime || undefined,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateMeeting(meeting.id, input)
        : await createMeeting(input);

      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  function handleDelete() {
    if (!meeting) return;
    if (
      !window.confirm(
        `Excluir a reunião "${meeting.title}"? Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteMeeting(meeting.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEditing ? "Editar reunião" : "Nova reunião"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div>
          <Label htmlFor="meeting-title">Título</Label>
          <Input
            id="meeting-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="Ex: Reunião de alinhamento"
            disabled={readOnly}
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="meeting-description">Descrição</Label>
          <Textarea
            id="meeting-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Detalhes adicionais (opcional)"
            disabled={readOnly}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="meeting-date">Data</Label>
            <Input
              id="meeting-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={readOnly}
            />
          </div>
          <div>
            <Label htmlFor="meeting-start">Início</Label>
            <Input
              id="meeting-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              disabled={readOnly}
            />
          </div>
          <div>
            <Label htmlFor="meeting-end">Fim</Label>
            <Input
              id="meeting-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {isEditing && canManage ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleDelete}
              disabled={isPending}
            >
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              {readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button type="submit" isLoading={isPending}>
                {isEditing ? "Salvar" : "Criar reunião"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
