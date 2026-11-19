import { AgentNoticeRing } from "./AgentNoticeRing";
import { pileOf, type AgentNoticeStackItem } from "./noticeStack.ts";
import "./AgentNoticeStack.css";

export function AgentNoticePile({ items, index, label, onOpen }: { items: readonly AgentNoticeStackItem[]; index: number; label: string | null; onOpen: (() => void) | null }) {
  const { shown, extra } = pileOf(items, index);
  const rings = (
    <>
      {shown.map((item) => <AgentNoticeRing key={item.key} item={item} size={16} />)}
      {extra > 0 && <span className="agent-notice-stack__extra">+{extra}</span>}
    </>
  );
  if (!onOpen || !label) return <span className="agent-notice-stack__pile">{rings}</span>;
  return (
    <button className="agent-notice-stack__pile" type="button" aria-label={label} title={label} onPointerEnter={onOpen} onClick={onOpen}>
      {rings}
    </button>
  );
}
