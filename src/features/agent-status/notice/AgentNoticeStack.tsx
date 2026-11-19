import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { useTranslation } from "../../../i18n";
import { AgentProviderIcon } from "../AgentProviderIcon";
import type { AgentNoticeNotch, AgentNoticeStack as StackMode } from "../agentSettings";
import { activeIndex, peekSlivers, pileOf, stackCount, type AgentNoticeStackItem } from "./noticeStack.ts";
import "./AgentNoticeStack.css";

const COUNT_CHIP = ".agent-notice__count";

export type AgentNoticeStackSlot = { count: string | null; icon: ReactNode | null };

function Ring({ item, size }: { item: AgentNoticeStackItem; size: number }) {
  return (
    <span className={`agent-notice-stack__ring agent-notice-stack--tone-${item.tone}`} style={{ "--stack-icon": `${size}px` } as CSSProperties}>
      <AgentProviderIcon provider={item.provider} size={size} />
    </span>
  );
}

function Pile({ items, index, label, onOpen }: { items: readonly AgentNoticeStackItem[]; index: number; label: string | null; onOpen: (() => void) | null }) {
  const { shown, extra } = pileOf(items, index);
  const rings = (
    <>
      {shown.map((item) => <Ring key={item.key} item={item} size={16} />)}
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

export function AgentNoticeStack({
  mode,
  notch,
  items,
  activeKey,
  onSelect,
  stackRef,
  children,
}: {
  mode: StackMode;
  notch: AgentNoticeNotch;
  items: readonly AgentNoticeStackItem[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  stackRef?: Ref<HTMLDivElement>;
  children: (slot: AgentNoticeStackSlot) => ReactNode;
}) {
  const copy = useTranslation().agentNoticeStack;
  const [listOpen, setListOpen] = useState(false);
  const index = activeIndex(items, activeKey);
  const active = items[index] ?? null;
  const many = items.length > 1;
  const open = many && listOpen;
  const show = () => setListOpen(true);
  const hide = () => setListOpen(false);
  const showAll = copy.showAll(items.length - 1);
  const pile = mode === "wings" && many ? <Pile items={items} index={index} label={showAll} onOpen={show} /> : null;

  const overChip = (event: PointerEvent<HTMLDivElement>) => {
    if (mode === "count" && many && event.target instanceof Element && event.target.closest(COUNT_CHIP)) show();
  };
  const clickChip = (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== "count" || !many || !(event.target instanceof Element) || !event.target.closest(COUNT_CHIP)) return;
    event.stopPropagation();
    setListOpen((current) => !current);
  };
  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    hide();
  };
  const pick = (key: string) => {
    hide();
    if (key !== active?.key) onSelect(key);
  };

  return (
    <div
      ref={stackRef}
      className={`agent-notice-stack agent-notice-stack--${mode} agent-notice-stack--notch-${notch}${open ? " agent-notice-stack--open" : ""}`}
      data-island-notch-band={notch === "band" && active ? "" : undefined}
      onPointerOver={overChip}
      onPointerLeave={hide}
      onClickCapture={clickChip}
      onKeyDown={closeOnEscape}
    >
      {notch === "band" && active && (
        <div className="agent-notice-stack__notch" aria-hidden="true">
          <span className="agent-notice-stack__wing agent-notice-stack__wing--left">
            {mode === "wings" && many ? <Pile items={items} index={index} label={null} onOpen={null} /> : <Ring item={active} size={16} />}
          </span>
          <span className="agent-notice-stack__camera" />
          <span className={`agent-notice-stack__wing agent-notice-stack__wing--right agent-notice-stack--tone-${active.tone}`}>
            <span className="agent-notice-stack__state">{active.state}</span>
          </span>
        </div>
      )}
      {children({ count: stackCount(mode, items.length, index), icon: pile })}
      {mode === "peek" && many && !open && (
        <button className="agent-notice-stack__slivers" type="button" aria-label={showAll} title={showAll} onPointerEnter={show} onClick={show}>
          {peekSlivers(items, index).map((item, at) => (
            <i key={item.key} className={`agent-notice-stack__sliver agent-notice-stack--tone-${item.tone}`} style={{ "--sliver-inset": `${(at + 1) * 4}%` } as CSSProperties} />
          ))}
        </button>
      )}
      {open && (
        <ul className="agent-notice-stack__list" aria-label={copy.list}>
          {items.map((item) => (
            <li key={item.key}>
              <button
                className={`agent-notice-stack__row agent-notice-stack--tone-${item.tone}`}
                type="button"
                aria-current={item.key === active?.key ? "true" : undefined}
                onClick={() => pick(item.key)}
              >
                <i className="agent-notice-stack__dot" aria-hidden="true" />
                <AgentProviderIcon provider={item.provider} size={14} />
                <span className="agent-notice-stack__title">{item.title}</span>
                <span className="agent-notice-stack__state">{item.state}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
