// Shape persisted into layout_preferences.layout_json (a jsonb column with
// no schema of its own) so the board's filter state survives reloads.
export type BoardFilters = {
  statusFilter: string;
  sprintFilter: string;
  developerFilter: string;
  onlyMine: boolean;
  searchQuery: string;
};

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  statusFilter: "all",
  sprintFilter: "all",
  developerFilter: "all",
  onlyMine: false,
  searchQuery: "",
};

export function parseBoardFilters(json: unknown): BoardFilters {
  if (!json || typeof json !== "object") return DEFAULT_BOARD_FILTERS;
  const raw = json as Record<string, unknown>;

  return {
    statusFilter:
      typeof raw.statusFilter === "string"
        ? raw.statusFilter
        : DEFAULT_BOARD_FILTERS.statusFilter,
    sprintFilter:
      typeof raw.sprintFilter === "string"
        ? raw.sprintFilter
        : DEFAULT_BOARD_FILTERS.sprintFilter,
    developerFilter:
      typeof raw.developerFilter === "string"
        ? raw.developerFilter
        : DEFAULT_BOARD_FILTERS.developerFilter,
    onlyMine:
      typeof raw.onlyMine === "boolean"
        ? raw.onlyMine
        : DEFAULT_BOARD_FILTERS.onlyMine,
    searchQuery:
      typeof raw.searchQuery === "string"
        ? raw.searchQuery
        : DEFAULT_BOARD_FILTERS.searchQuery,
  };
}
