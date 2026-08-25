import { URGENCY_LABELS } from "@/components/board/urgency-badge";
import type { Tables } from "@/types/database.types";

// ";" instead of "," — a plain comma-CSV opens in Excel's pt-BR locale
// with everything crammed into one column, since that locale already uses
// "," as the decimal separator. Semicolon-delimited opens correctly with
// no import wizard. The BOM ensures accented characters (Aprovação, Não)
// survive Excel's encoding guess.
const DELIMITER = ";";
const BOM = "﻿";

function escapeCsvField(value: string): string {
  if (value.includes(DELIMITER) || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function ticketsToCsv(
  tickets: Tables<"tickets">[],
  lookups: {
    statusesById: Map<string, string>;
    clientsById: Map<string, string>;
    ticketTypesById: Map<string, string>;
    developersById: Map<string, string>;
    membersById: Map<string, string>;
    sprintsById: Map<string, string>;
  }
): string {
  const headers = [
    "Número",
    "Título",
    "Status",
    "Urgência",
    "Cliente",
    "Tipo",
    "Desenvolvedor",
    "Registrado para",
    "Sprint",
    "Prazo",
    "Execução prevista",
    "Criado em",
  ];

  const rows = tickets.map((t) => [
    String(t.ticket_number),
    t.title,
    lookups.statusesById.get(t.status_id) ?? "",
    URGENCY_LABELS[t.urgency],
    t.client_id ? lookups.clientsById.get(t.client_id) ?? "" : "",
    t.type_id ? lookups.ticketTypesById.get(t.type_id) ?? "" : "",
    t.developer_id ? lookups.developersById.get(t.developer_id) ?? "" : "",
    lookups.membersById.get(t.created_by) ?? "",
    t.sprint_id ? lookups.sprintsById.get(t.sprint_id) ?? "" : "",
    formatDate(t.deadline),
    formatDate(t.execution_deadline),
    formatDate(t.created_at),
  ]);

  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvField).join(DELIMITER)
  );

  return BOM + lines.join("\r\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
