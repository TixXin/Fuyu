const SPLIT_FROM = 40;
const MAX_TAIL = 36;

export function splitToolDetail(detail: string): { head: string; tail: string } {
  if (detail.length <= SPLIT_FROM) return { head: detail, tail: "" };
  const cut = Math.max(detail.lastIndexOf("/"), detail.lastIndexOf("\\"));
  if (cut <= 0 || cut === detail.length - 1 || detail.length - cut > MAX_TAIL) return { head: detail, tail: "" };
  return { head: detail.slice(0, cut), tail: detail.slice(cut) };
}
