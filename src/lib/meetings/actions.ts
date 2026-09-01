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
};

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

  const { error } = await supabase.from("meetings").insert({
    organization_id: membership.organization_id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    meeting_date: parsed.data.meetingDate,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime || null,
    created_by: user.id,
  });

  if (error) {
    return { error: "Não foi possível criar a reunião" };
  }

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
