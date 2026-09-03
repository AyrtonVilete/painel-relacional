// Nexus's own organization in Painel Relacional — the only tenant whose
// members should ever see PDVNET data, since it's Nexus's own product
// backlog in Azure DevOps, not something relevant to other orgs.
export const NEXUS_ORG_ID = "d883e396-8319-408f-9f5c-6fea38da9334";

// Only these tags are pulled in — they're how the team already marks a
// work item as customer-facing, as opposed to the ~1100 QA test case/suite/
// plan items and purely-internal dev tasks that share the same project.
export const PDVNET_CUSTOMER_TAGS = [
  "Relacionamento",
  "Suporte",
  "Urgente",
  "Diretoria",
  "Chamado Antigo",
  "Gestao",
] as const;

// States that count as "resolved" across every work item type observed in
// PDVNET (Bug/Feature/Epic all use this same vocabulary).
export const PDVNET_CLOSED_STATES = ["Done", "Removed", "Closed", "Not Approved"];
