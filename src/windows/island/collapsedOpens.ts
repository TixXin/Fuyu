export type OpensItem = { id: string; owner: string; opens?: unknown };
export type OpensPage = { id: string; owner: string };
export type OpensTarget = { page: string | null; warning: string | null };

export function collapsedOpensTarget(item: OpensItem, pages: readonly OpensPage[]): OpensTarget {
  const { id, owner, opens } = item;
  if (opens === undefined) return { page: null, warning: null };
  const lead = `island.collapsed/v1 item ${id} from ${owner}`;
  if (typeof opens !== "string" || opens === "") return { page: null, warning: `${lead} has an opens that is not a page id, so it does not open anything` };
  const page = pages.find((candidate) => candidate.id === opens);
  if (page?.owner === owner) return { page: opens, warning: null };
  const why = page ? `which belongs to ${page.owner}` : "and that plugin has no island.page/v1 with that id";
  return { page: null, warning: `${lead} opens ${opens}, ${why}; it can only open its own island pages, so clicking it does nothing` };
}

const warned = new Set<string>();

export function warnCollapsedOpens(warning: string | null) {
  if (warning === null || warned.has(warning)) return;
  warned.add(warning);
  console.warn(warning);
}
