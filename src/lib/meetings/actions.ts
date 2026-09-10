"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";

const meetingSchema = z
  .object({
    title: z.string().min(1, "Informe um título").max(200),
    description: z.string().max(2000).optional(),
    meetingDate: z.string().min(1, "Informe a data"),
    startTime: z.string().min(1, "Informe o horário de início"),
    endTime: z.string().optional(),
    participantIds: z.array(z.string().uuid()).default([]),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: "O horário de término deve ser depois do início",
    path: ["endTime"],
  });

export type MeetingInput = {
  title: string;
  description?: string;
  meetingDate: string;
  startTime: string;
  endTime?: string;
  participantIds?: string[];
};

// Adds newly-invited participants and notifies them, and drops anyone no
// longer in the list — same "only notify who's actually still there" spirit
// as the ticket-comment @mention flow, applied to an edit instead of a
// single post. `previousParticipantIds` is omitted on create (nothing to
// diff against, everyone passed in is new).
async function syncParticipants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    meetingId,
    title,
    actorId,
    participantIds,
    previousParticipantIds,
  }: {
    meetingId: string;
    title: string;
    actorId: string;
    participantIds: string[];
    previousParticipantIds?: string[];
  }
) {
  const nextIds = new Set(participantIds.filter((id) => id !== actorId));
  const previousIds = new Set(previousParticipantIds ?? []);

  const toAdd = Array.from(nextIds).filter((id) => !previousIds.has(id));
  const toRemove = previousParticipantIds
    ? Array.from(previousIds).filter((id) => !nextIds.has(id))
    : [];

  if (toRemove.length > 0) {
    await supabase
      .from("meeting_participants")
      .delete()
      .eq("meeting_id", meetingId)
      .in("user_id", toRemove);
  }

  if (toAdd.length === 0) return;

  const { error: insertError } = await supabase.from("meeting_participants").insert(
    toAdd.map((userId) => ({
      meeting_id: meetingId,
      user_id: userId,
      added_by: actorId,
    }))
  );
  if (insertError) return;

  await supabase.from("notifications").insert(
    toAdd.map((userId) => ({
      recipient_id: userId,
      actor_id: actorId,
      meeting_id: meetingId,
      body_preview: `Você foi convidado para a reunião: ${title}`.slice(0, 200),
    }))
  );
}

export async function createMeeting(
  input: MeetingInput
): Promise<{ error?: string }> {
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const membership = await getCurrentMembership();
  if (!membership) {
    return { error: "Organização não encontrada" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessão expirada, faça login novamente" };
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      organization_id: membership.organization_id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      meeting_date: parsed.data.meetingDate,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !meeting) {
    return { error: "Não foi possível criar a reunião" };
  }

  await syncParticipants(supabase, {
    meetingId: meeting.id,
    title: parsed.data.title,
    actorId: user.id,
    participantIds: parsed.data.participantIds,
  });

  revalidatePath("/agenda");
  return {};
}

export async function updateMeeting(
  id: string,
  input: MeetingInput
): Promise<{ error?: string }> {
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessão expirada, faça login novamente" };
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      meeting_date: parsed.data.meetingDate,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime || null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar a reunião" };
  }

  const { data: existingParticipants } = await supabase
    .from("meeting_participants")
    .select("user_id")
    .eq("meeting_id", id);

  await syncParticipants(supabase, {
    meetingId: id,
    title: parsed.data.title,
    actorId: user.id,
    participantIds: parsed.data.participantIds,
    previousParticipantIds: (existingParticipants ?? []).map((p) => p.user_id),
  });

  revalidatePath("/agenda");
  return {};
}

export async function deleteMeeting(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a reunião" };
  }

  revalidatePath("/agenda");
  return {};
}
