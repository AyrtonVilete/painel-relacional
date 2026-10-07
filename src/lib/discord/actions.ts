"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { NEXUS_ORG_ID } from "@/lib/pdvnet/constants";
import type { Tables } from "@/types/database.types";

const ticketIdSchema = z.string().uuid();

const URGENCY_LABELS = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
} as const;

const URGENCY_COLORS = {
  low: 0x94a3b8,
  medium: 0x3b82f6,
  high: 0xf59e0b,
  critical: 0xef4444,
} as const;

// "2026-10-17" -> "17/10/2026", without going through Date (no timezone shift).
function formatDateOnly(value: string | null) {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const MAX_CUSTOM_MESSAGE = 1000;

const PDVNET_TICKET_URL = "https://app.pdvnet.com.br/app/Chamado";

// The supervisor is tagged via a real Discord mention (<@userId> for a person,
// <@&roleId> for a role) kept in an env var, so the id never lives in code or
// the browser. Anything else is ignored rather than posted.
function supervisorMention() {
  const raw = process.env.DISCORD_COBRANCA_SUPERVISOR_MENTION?.trim();
  const match = raw?.match(/^<@(&?)(\d{15,25})>$/);
  if (!raw || !match) return null;
  return { text: raw, kind: match[1] ? ("roles" as const) : ("users" as const), id: match[2] };
}

export async function getCobrancaOptions(): Promise<{ supervisorMention: boolean }> {
  return { supervisorMention: supervisorMention() !== null };
}

// The ticket data in the message is read back from the database by ticket id
// — the only things trusted from the browser are the id and the free-text
// note the person typed, so a tampered request can't make the bot post
// arbitrary ticket data to the channel.
//
// One click both sends the cobrança and marks it as done on the chamado; the
// updated chamado comes back so the board can refresh without a reload.
export async function sendCobrancaToDiscord(
  ticketId: string,
  options?: { message?: string; mentionSupervisor?: boolean }
): Promise<{
  error?: string;
  ticket?: Tables<"tickets">;
  // Sent to Discord but couldn't be recorded on the chamado.
  notMarked?: boolean;
}> {
  const parsedId = ticketIdSchema.safeParse(ticketId);
  if (!parsedId.success) return { error: "Chamado inválido" };

  const customMessage = (options?.message ?? "").trim();
  if (customMessage.length > MAX_CUSTOM_MESSAGE) {
    return { error: `A mensagem pode ter no máximo ${MAX_CUSTOM_MESSAGE} caracteres` };
  }
  const mention = options?.mentionSupervisor ? supervisorMention() : null;

  // A plain text channel and a forum channel need differently shaped
  // payloads (a forum post requires thread_name, a text channel rejects it),
  // so each gets its own variable; whichever are configured receive the
  // cobrança.
  const destinations: { label: string; url: string; forum: boolean }[] = [];
  const textUrl = process.env.DISCORD_COBRANCA_WEBHOOK_URL;
  const forumUrl = process.env.DISCORD_COBRANCA_FORUM_WEBHOOK_URL;
  if (textUrl) destinations.push({ label: "canal", url: textUrl, forum: false });
  if (forumUrl) destinations.push({ label: "fórum", url: forumUrl, forum: true });

  if (destinations.length === 0) return { error: "Webhook do Discord não configurado" };
  if (
    destinations.some(
      (d) => !/^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\//.test(d.url)
    )
  ) {
    return { error: "Webhook do Discord inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  // RLS already limits this to tickets the caller can see.
  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, organization_id, ticket_number, title, description, urgency, deadline, execution_deadline, client_id, type_id, developer_id"
    )
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!ticket) return { error: "Chamado não encontrado" };

  // The channel belongs to Nexus — never post another tenant's tickets to it.
  if (ticket.organization_id !== NEXUS_ORG_ID) {
    return { error: "Cobrança no Discord não disponível para esta organização" };
  }

  const [{ data: client }, { data: type }, { data: developer }, { data: profile }] =
    await Promise.all([
      ticket.client_id
        ? supabase.from("clients").select("name").eq("id", ticket.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.type_id
        ? supabase.from("ticket_types").select("name").eq("id", ticket.type_id).maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.developer_id
        ? supabase.from("developers").select("name").eq("id", ticket.developer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);

  const execution = formatDateOnly(ticket.execution_deadline);
  const deadline = formatDateOnly(ticket.deadline);

  const fields = [
    { name: "Cliente", value: client?.name ?? "—", inline: true },
    { name: "Tipo", value: type?.name ?? "—", inline: true },
    { name: "Urgência", value: URGENCY_LABELS[ticket.urgency], inline: true },
    {
      name: "Execução prevista",
      value: execution ?? "Não definida",
      inline: true,
    },
    ...(deadline ? [{ name: "Prazo", value: deadline, inline: true }] : []),
    { name: "Desenvolvedor", value: developer?.name ?? "Sem desenvolvedor", inline: true },
    // Right under the ticket data, as asked. It's inside the embed, so any
    // @mention typed here renders but never notifies — real pings go through
    // the supervisor checkbox below.
    ...(customMessage
      ? [{ name: "Mensagem", value: customMessage, inline: false }]
      : []),
  ];

  // Leads with the chamado's type ("Sugestão - #123 título", "Solicitação - …")
  // for both the embed title and the forum post name; "Cobrança" only as a
  // fallback when the chamado has no type set.
  const heading = `${type?.name ?? "Cobrança"} - #${ticket.ticket_number} ${ticket.title}`;

  const pdvnetUrl = `${PDVNET_TICKET_URL}/${ticket.ticket_number}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const painelUrl =
    siteUrl && !siteUrl.includes("localhost")
      ? `${siteUrl.replace(/\/$/, "")}/board?ticket=${ticket.id}`
      : null;
  const links = [
    `**Chamado [#${ticket.ticket_number}](${pdvnetUrl})**`,
    ...(painelUrl ? [`[Abrir no painel](${painelUrl})`] : []),
  ].join(" · ");

  const embed = {
    title: truncate(heading, 256),
    // Clicking the title also goes straight to the chamado in PDVNET.
    url: pdvnetUrl,
    description: `${links}\n\n${
      ticket.description ? truncate(ticket.description, 1500) : "Sem descrição."
    }`,
    color: URGENCY_COLORS[ticket.urgency],
    fields,
    footer: { text: `Gerada por ${profile?.full_name ?? user.email ?? "usuário"}` },
    timestamp: new Date().toISOString(),
  };

  // Forum posts are titled by thread_name (100 chars max); the date keeps
  // repeated cobranças for the same chamado distinguishable in the list.
  const today = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const threadName = truncate(
    heading,
    100 - ` (${today})`.length
  ).concat(` (${today})`);

  const results = await Promise.all(
    destinations.map(async (destination) => {
      try {
        const response = await fetch(destination.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // parse: [] stops a description containing @everyone/@here/@user
          // from actually pinging anyone; the only ping that can go out is
          // the one supervisor id explicitly allowed here.
          body: JSON.stringify({
            ...(mention ? { content: mention.text } : {}),
            embeds: [embed],
            allowed_mentions: mention
              ? { parse: [], [mention.kind]: [mention.id] }
              : { parse: [] },
            ...(destination.forum ? { thread_name: threadName } : {}),
          }),
          cache: "no-store",
        });
        return { label: destination.label, ok: response.ok };
      } catch {
        return { label: destination.label, ok: false };
      }
    })
  );

  const failed = results.filter((r) => !r.ok).map((r) => r.label);
  if (failed.length === results.length) {
    return { error: "O Discord recusou a mensagem de cobrança" };
  }
  const partialError =
    failed.length > 0
      ? `Cobrança enviada, mas falhou no ${failed.join(" e no ")} do Discord`
      : undefined;

  // At least one destination got the message, so the cobrança happened:
  // record it on the chamado (last_followup_at = now, which the database
  // turns into the next reminder date) — the same update the old "Marquei a
  // cobrança" button made, so the reminder dates and the dashboard's cobrança
  // stats move exactly as before.
  const { data: marked, error: markError } = await supabase
    .from("tickets")
    .update({ last_followup_at: new Date().toISOString() })
    .eq("id", ticket.id)
    .select()
    .single();
  if (markError || !marked) return { error: partialError, notMarked: true };

  return { error: partialError, ticket: marked };
}
