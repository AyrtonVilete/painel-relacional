"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingDialog } from "@/components/agenda/meeting-dialog";
import { cn } from "@/lib/utils/cn";
import type { Tables } from "@/types/database.types";

type Meeting = Tables<"meetings">;
type TicketDeadline = { id: string; label: string; date: string };

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function monthLabel(date: Date) {
  const month = format(date, "MMMM", { locale: ptBR });
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} de ${format(date, "yyyy")}`;
}

export function AgendaCalendar({
  meetings,
  ticketDeadlines,
  currentUserId,
  membersById,
  isAdmin,
}: {
  meetings: Meeting[];
  ticketDeadlines: TicketDeadline[];
  currentUserId: string;
  membersById: Map<string, string>;
  isAdmin: boolean;
}) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [dialogState, setDialogState] = useState<
    { mode: "create"; date: string } | { mode: "edit"; meeting: Meeting } | null
  >(null);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const meeting of meetings) {
      const list = map.get(meeting.meeting_date) ?? [];
      list.push(meeting);
      map.set(meeting.meeting_date, list);
    }
    for (const list of Array.from(map.values())) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [meetings]);

  const deadlinesByDay = useMemo(() => {
    const map = new Map<string, TicketDeadline[]>();
    for (const deadline of ticketDeadlines) {
      const list = map.get(deadline.date) ?? [];
      list.push(deadline);
      map.set(deadline.date, list);
    }
    return map;
  }, [ticketDeadlines]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const today = new Date();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <h2 className="min-w-[11rem] text-center text-lg font-semibold text-slate-900 dark:text-slate-100">
            {monthLabel(viewMonth)}
          </h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setViewMonth(startOfMonth(new Date()))}
          >
            Hoje
          </Button>
        </div>
        <Button
          type="button"
          onClick={() => setDialogState({ mode: "create", date: toKey(new Date()) })}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nova reunião
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-slate-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400"
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const key = toKey(day);
          const dayMeetings = meetingsByDay.get(key) ?? [];
          const dayDeadlines = deadlinesByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, viewMonth);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[7rem] flex-col gap-1 bg-white p-1.5 dark:bg-slate-900",
                !inMonth && "bg-slate-50 dark:bg-slate-950"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday
                      ? "bg-indigo-600 text-white"
                      : inMonth
                        ? "text-slate-700 dark:text-slate-300"
                        : "text-slate-400 dark:text-slate-600"
                  )}
                >
                  {format(day, "d")}
                </span>
                <button
                  type="button"
                  onClick={() => setDialogState({ mode: "create", date: key })}
                  aria-label="Nova reunião neste dia"
                  className="rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {dayMeetings.map((meeting) => {
                  const creatorName = membersById.get(meeting.created_by) ?? "Sem nome";
                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => setDialogState({ mode: "edit", meeting })}
                      title={`${meeting.title} — ${creatorName}`}
                      className="rounded bg-indigo-100 px-1.5 py-0.5 text-left leading-tight hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900"
                    >
                      <p className="truncate text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        {meeting.start_time.slice(0, 5)} {meeting.title}
                      </p>
                      <p className="truncate text-[11px] text-indigo-500 dark:text-indigo-400">
                        {creatorName}
                      </p>
                    </button>
                  );
                })}
                {dayDeadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    title={deadline.label}
                    className="truncate rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  >
                    {deadline.label}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {dialogState && (
        <MeetingDialog
          open
          onClose={() => setDialogState(null)}
          initialDate={dialogState.mode === "create" ? dialogState.date : undefined}
          meeting={dialogState.mode === "edit" ? dialogState.meeting : undefined}
          canManage={
            dialogState.mode === "create" ||
            dialogState.meeting.created_by === currentUserId ||
            isAdmin
          }
        />
      )}
    </div>
  );
}
