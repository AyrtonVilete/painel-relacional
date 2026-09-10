"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { createMeeting, updateMeeting, deleteMeeting } from "@/lib/meetings/actions";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

type Member = { id: string; name: string };

export function MeetingDialog({
  open,
  onClose,
  initialDate,
  meeting,
  canManage,
  members,
}: {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
  meeting?: Tables<"meetings">;
  canManage: boolean;
  members: Member[];
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

  const [participants, setParticipants] = useState<Member[]>([]);
  const [participantQuery, setParticipantQuery] = useState("");
  const [showParticipantOptions, setShowParticipantOptions] = useState(false);
  const participantInputRef = useRef<HTMLInputElement>(null);

  // On edit, load who's already invited so the picker starts pre-filled —
  // meetings passed down from the calendar don't carry participants (kept
  // the server query on /agenda lean), so this fetches on dialog open.
  useEffect(() => {
    if (!meeting) return;
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("meeting_participants")
      .select("user_id")
      .eq("meeting_id", meeting.id)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const membersById = new Map(members.map((m) => [m.id, m.name]));
        setParticipants(
          data
            .map((p) => ({ id: p.user_id, name: membersById.get(p.user_id) }))
            .filter((p): p is Member => Boolean(p.name))
        );
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

  function handleParticipantQueryChange(e: ChangeEvent<HTMLInputElement>) {
    setParticipantQuery(e.target.value);
    setShowParticipantOptions(true);
  }

  function handleAddParticipant(member: Member) {
    setParticipants((prev) =>
      prev.some((p) => p.id === member.id) ? prev : [...prev, member]
    );
    setParticipantQuery("");
    setShowParticipantOptions(false);
    participantInputRef.current?.focus();
  }

  function handleRemoveParticipant(id: string) {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  }

  const participantOptions = members
    .filter((m) => !participants.some((p) => p.id === m.id))
    .filter((m) => m.name.toLowerCase().includes(participantQuery.toLowerCase()))
    .slice(0, 6);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const input = {
      title,
      description: description.trim() || undefined,
      meetingDate: date,
      startTime,
      endTime: endTime || undefined,
      participantIds: participants.map((p) => p.id),
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

        <div>
          <Label htmlFor="meeting-participants">Participantes</Label>
          {participants.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {participants.map((p) => (
                <li
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                >
                  {p.name}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.id)}
                      aria-label={`Remover ${p.name}`}
                      className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!readOnly && (
            <div className="relative">
              <Input
                ref={participantInputRef}
                id="meeting-participants"
                value={participantQuery}
                onChange={handleParticipantQueryChange}
                onFocus={() => setShowParticipantOptions(true)}
                onBlur={() => setTimeout(() => setShowParticipantOptions(false), 150)}
                placeholder="Digite @ pra marcar quem vai participar"
                autoComplete="off"
              />
              {showParticipantOptions && participantOptions.length > 0 && (
                <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  {participantOptions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAddParticipant(m)}
                      className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
