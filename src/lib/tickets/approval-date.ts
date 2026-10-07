// approved_at is a UTC timestamp stamped by the database. Anything the person
// sees or filters on is read in Brazil time, so an approval at 22:30 on the
// 6th doesn't land on the 7th just because UTC is three hours ahead.
const TIME_ZONE = "America/Sao_Paulo";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// "YYYY-MM-DD" in Brazil time — comparable with the value of <input type="date">.
export function approvedDay(approvedAt: string | null | undefined): string | null {
  if (!approvedAt) return null;
  const date = new Date(approvedAt);
  return Number.isNaN(date.getTime()) ? null : dayFormatter.format(date);
}

// "06/10/2026 22:30"
export function formatApprovedAt(approvedAt: string | null | undefined): string {
  if (!approvedAt) return "";
  const date = new Date(approvedAt);
  return Number.isNaN(date.getTime())
    ? ""
    : dateTimeFormatter.format(date).replace(",", "");
}
