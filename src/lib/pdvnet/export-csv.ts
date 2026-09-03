import type { Tables } from "@/types/database.types";

// Same conventions as src/lib/tickets/export-csv.ts (semicolon delimiter +
// BOM so it opens correctly in Excel's pt-BR locale without an import
// wizard, and accented characters survive).
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

export function pdvnetTicketsToCsv(tickets: Tables<"pdvnet_tickets">[]): string {
  const headers = [
    "ID Azure DevOps",
    "Chamado",
    "Título",
    "Tipo",
    "Status",
    "Tags",
    "Cliente",
    "Sistema",
    "Responsável",
    "Prioridade",
    "Criado em",
    "Aprovado em",
    "Commit em",
    "QA em",
    "Fechado em",
  ];

  const rows = tickets.map((t) => [
    String(t.ado_id),
    t.chamado ? String(t.chamado) : "",
    t.title,
    t.work_item_type,
    t.state,
    t.tags.join(", "),
    t.cliente ?? "",
    t.sistema ?? "",
    t.dev_owner ?? t.assigned_to ?? "",
    t.priority ? String(t.priority) : "",
    formatDate(t.created_date),
    formatDate(t.approved_date),
    formatDate(t.committed_date),
    formatDate(t.qa_date),
    formatDate(t.closed_date),
  ]);

  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(DELIMITER));
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
