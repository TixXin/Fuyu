import type { CSSProperties, FormEvent, RefObject } from "react";
import { BellRing, Check, Columns2, Gauge, LayoutGrid, PanelRight, Pause, Play, Plus, Timer as TimerIcon, Watch, X, type LucideIcon } from "lucide-react";
import { RowMenu, type RowMenuItem } from "../../../components/list/RowMenu";
import { useLocale, useTranslation } from "../../../i18n";
import { usePluginNames } from "../../plugin-kernel/pluginNames";
import { localizedTitle, packageLabel } from "../../plugin-kernel/slotTitle";
import { etaClockText, progressOf, TIMER_LAYOUTS, type TimerLayout } from "../timerLayout.ts";
import { clockText, EXTEND_MS, isFinished, parseDuration, shownMs, type Timer } from "../timers.ts";

export const TIMER_LAYOUT_ICONS: Record<TimerLayout, LucideIcon> = {
  split: Columns2,
  dial: Gauge,
  grid: LayoutGrid,
  hub: PanelRight,
};

export function useOwnerName(owner: string | undefined): string | null {
  const names = usePluginNames();
  const { locale } = useLocale();
  if (!owner) return null;
  return localizedTitle(names.get(owner), locale) ?? packageLabel(owner);
}

export function TimerLayoutMenu({ layout, onLayout }: { layout: TimerLayout; onLayout: (next: TimerLayout) => void }) {
  const t = useTranslation().timer;
  const Icon = TIMER_LAYOUT_ICONS[layout];
  const items: RowMenuItem[] = TIMER_LAYOUTS.map((id) => {
    const ItemIcon = TIMER_LAYOUT_ICONS[id];
    return {
      key: id,
      label: t.layout.options[id].name,
      icon: id === layout ? <Check size={14} strokeWidth={2.2} aria-hidden="true" /> : <ItemIcon size={14} strokeWidth={1.8} aria-hidden="true" />,
      onSelect: () => onLayout(id),
    };
  });
  return (
    <RowMenu label={t.panel.layoutButton(t.layout.options[layout].name)} items={items} buttonClassName="timer-panel__icon-btn">
      <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
    </RowMenu>
  );
}

export function TimerInputForm({
  text,
  problem,
  inputRef,
  compact = false,
  onTextChange,
  onSubmit,
}: {
  text: string;
  problem: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  compact?: boolean;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const t = useTranslation().timer;
  const parsed = parseDuration(text);
  const invalid = problem === t.invalid;
  return (
    <form className={`timer-panel__form${compact ? " timer-panel__form--compact" : ""}${invalid ? " timer-panel__form--invalid" : ""}`} onSubmit={onSubmit}>
      <input
        ref={inputRef}
        className="timer-panel__input"
        value={text}
        placeholder={t.placeholder}
        aria-label={t.start}
        aria-invalid={invalid}
        onChange={(event) => onTextChange(event.target.value)}
      />
      {parsed !== null && <span className="timer-panel__parsed">{clockText(parsed, true)}</span>}
      <button className="timer-panel__go" type="submit" aria-label={t.start} title={t.start}>
        <Play size={12} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </form>
  );
}

export function TimerCompactRow({
  timer,
  now,
  onToggle,
  onExtend,
  onCancel,
}: {
  timer: Timer;
  now: number;
  onToggle: (timer: Timer) => void;
  onExtend: (timer: Timer, addMs: number) => void;
  onCancel: (id: string) => void;
}) {
  const t = useTranslation().timer;
  const ownerName = useOwnerName(timer.owner);
  const done = isFinished(timer, now);
  const running = timer.runningSince !== null;
  const Icon = done ? BellRing : timer.kind === "countdown" ? TimerIcon : Watch;
  const ms = shownMs(timer, now);
  const label = timer.kind === "countdown" ? `${t.countdown} · ${clockText(timer.durationMs, true)}` : t.stopwatchLabel;
  const source = ownerName ? t.from(ownerName) : null;
  const kind = done ? t.ended : label;
  const pct = timer.kind === "countdown" ? (done ? 100 : (1 - progressOf(timer, now)) * 100) : 100;
  const sub = done
    ? t.ended
    : timer.kind === "countdown"
      ? (running ? t.panel.etaShort(etaClockText(ms, now)) : t.panel.pausedLabel)
      : (running ? t.panel.runningLabel : t.panel.pausedLabel);

  return (
    <li className={`timer-panel__row${done ? " timer-panel__row--done" : ""}${running || done ? "" : " timer-panel__row--paused"}`}>
      <Icon className="timer-panel__icon" size={14} strokeWidth={2} aria-hidden="true" />
      <span className="timer-panel__label timer-panel__label--sourced" title={source ? `${kind} · ${source}` : kind}>
        <span className="timer-panel__kind">{kind}</span>
        {source ? <span className="timer-panel__source">{source}</span> : <span className="timer-panel__sub">{sub}</span>}
      </span>
      <span className="timer-panel__time">{clockText(ms, timer.kind === "countdown")}</span>
      <span className="timer-panel__actions">
        {done ? (
          <button className="timer-panel__button timer-panel__button--solid" type="button" aria-label={t.extend} title={t.extend} onClick={() => onExtend(timer, EXTEND_MS)}>
            <Plus size={13} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : (
          <button
            className="timer-panel__button"
            type="button"
            aria-label={running ? t.pause : t.resume}
            title={running ? t.pause : t.resume}
            onClick={() => onToggle(timer)}
          >
            {running ? <Pause size={13} strokeWidth={2.2} aria-hidden="true" /> : <Play size={13} strokeWidth={2.2} aria-hidden="true" />}
          </button>
        )}
        <button className="timer-panel__button timer-panel__button--ghost" type="button" aria-label={done ? t.dismiss : t.cancel} title={done ? t.dismiss : t.cancel} onClick={() => onCancel(timer.id)}>
          <X size={13} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </span>
      <span className="timer-panel__bar" style={{ "--timer-progress": `${pct.toFixed(1)}%` } as CSSProperties} aria-hidden="true" />
    </li>
  );
}
