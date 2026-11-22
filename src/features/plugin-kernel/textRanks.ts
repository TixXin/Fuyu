import type { NotchTextKind, TextOrder } from "../../lib/settings/collapsedText.ts";

export type TextRanks = {
  meeting: number | null;
  lyrics: number | null;
  agent: number | null;
  agentInterjection: number | null;
  todoTitle: number | null;
  todoCount: number | null;
};

const BANDS = [60, 45, 40, 20] as const;
const SECOND_PLACE = 59;
const ABOVE_ALL = 61;

export function textRanks(order: TextOrder, hidden: readonly NotchTextKind[] = []): TextRanks {
  const band = (kind: NotchTextKind) => {
    const at = order.indexOf(kind);
    return hidden.includes(kind) || at < 0 ? null : BANDS[Math.min(at, BANDS.length - 1)];
  };
  const agent = band("agent");
  const todos = band("todos");
  return {
    meeting: band("meeting"),
    lyrics: band("lyrics"),
    agent,
    agentInterjection: agent === null ? null : order.indexOf("agent") === 0 ? ABOVE_ALL : SECOND_PLACE,
    todoTitle: todos,
    todoCount: todos === null ? null : todos - 2,
  };
}
