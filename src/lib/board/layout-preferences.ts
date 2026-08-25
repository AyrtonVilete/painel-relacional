// Shape persisted into layout_preferences.layout_json (a jsonb column with
// no schema of its own) so the board's filter state survives reloads.
export type BoardFilters = {
  statusFilter: string[];
  sprintFilter: string[];
  developerFilter: string[];
  clientFilter: string[];
  userFilter: string[];
  searchQuery: string;
  createdFrom: string;
  createdTo: string;
};

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  statusFilter: [],
  sprintFilter: [],
  developerFilter: [],
  clientFilter: [],
  userFilter: [],
  searchQuery: "",
  createdFrom: "",
  createdTo: "",
};

// statusFilter/sprintFilter/developerFilter/clientFilter used to be a single
// string ("all" | "none" | an id) before the multi-select filter chips —
// old rows already saved in layout_preferences still have that shape, so
// this normalizes either representation into the current string[] one
// (empty array = no filter applied, matching the old "all").
function normalizeMultiFilter(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.every((v) => typeof v === "string")) {
    return raw;
  }
  if (typeof raw === "string") {
    return raw === "all" || raw === "" ? [] : [raw];
  }
  return [];
}

export function parseBoardFilters(json: unknown): BoardFilters {
  if (!json || typeof json !== "object") return DEFAULT_BOARD_FILTERS;
  const raw = json as Record<string, unknown>;

  return {
    statusFilter: normalizeMultiFilter(raw.statusFilter),
    sprintFilter: normalizeMultiFilter(raw.sprintFilter),
    developerFilter: normalizeMultiFilter(raw.developerFilter),
    clientFilter: normalizeMultiFilter(raw.clientFilter),
    userFilter: normalizeMultiFilter(raw.userFilter),
    searchQuery:
      typeof raw.searchQuery === "string"
        ? raw.searchQuery
        : DEFAULT_BOARD_FILTERS.searchQuery,
    createdFrom:
      typeof raw.createdFrom === "string"
        ? raw.createdFrom
        : DEFAULT_BOARD_FILTERS.createdFrom,
    createdTo:
      typeof raw.createdTo === "string"
        ? raw.createdTo
        : DEFAULT_BOARD_FILTERS.createdTo,
  };
}
