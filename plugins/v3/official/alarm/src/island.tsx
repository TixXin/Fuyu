import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState } from "react";
import { playAlarmTone, ringLevel } from "./chime.ts";
import { clockOf, displayFor, type Display } from "./display.ts";
import { AlarmEditor, DraftOptions, TimeAndLabel } from "./editor.tsx";
import { METHODS, TOPICS, nextScheduledAlarm, type AlarmDraft, type AlarmItem, type AlarmSnapshot, type RingPayload } from "./model.ts";
import { PAGE_TITLE, text } from "./text.ts";
import { useAlarm } from "./useAlarm.ts";
import "./styles.css";

const PAGE_ID = "alarm";
const DEFAULT_DAYS = [1, 2, 3, 4, 5];

function AlarmIcon({ size = 16, strokeWidth = 2 }: { size?: number | string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M5 3 2 6M22 6l-3-3M12 9v4l2 2" />
    </svg>
  );
}

type Invoke = (method: string, params?: unknown) => void;

function RingBanner({ state, view, invoke }: { state: AlarmSnapshot; view: Display; invoke: Invoke }) {
  if (state.ringing) {
    return (
      <div className="fuyu-alarm__ring-banner" role="alert">
        <div className="fuyu-alarm__ring-info">
          <strong>{state.ringing.label || text.ringingNow}</strong>
          <span>{view.time(state.ringing.time)}</span>
        </div>
        <div className="fuyu-alarm__ring-actions">
          <button type="button" className="fuyu-alarm__mini" onClick={() => invoke(METHODS.snooze)}>
            {text.snooze(state.settings.snoozeMinutes)}
          </button>
          <button type="button" className="fuyu-alarm__button" onClick={() => invoke(METHODS.dismiss)}>
            {text.dismiss}
          </button>
        </div>
      </div>
    );
  }
  if (!state.snoozed) return null;
  return (
    <div className="fuyu-alarm__snoozed">
      <span>{text.snoozedUntil(view.time(clockOf(state.snoozed.dueAt)))}</span>
      <button type="button" className="fuyu-alarm__mini" onClick={() => invoke(METHODS.dismiss)}>
        {text.dismiss}
      </button>
    </div>
  );
}

function AlarmRow({ alarm, view, invoke, onEdit }: { alarm: AlarmItem; view: Display; invoke: Invoke; onEdit: () => void }) {
  return (
    <li className={alarm.enabled ? "fuyu-alarm__row" : "fuyu-alarm__row fuyu-alarm__row--off"}>
      <button type="button" className="fuyu-alarm__row-main" title={text.edit} onClick={onEdit}>
        <span className="fuyu-alarm__row-time">{view.time(alarm.time)}</span>
        <span className="fuyu-alarm__row-meta">
          {alarm.label ? `${alarm.label} · ` : ""}
          {view.days(alarm.days)}
        </span>
      </button>
      <input
        type="checkbox"
        className="fuyu-alarm__switch"
        aria-label={alarm.enabled ? text.on : text.off}
        checked={alarm.enabled}
        onChange={() => invoke(METHODS.toggle, { id: alarm.id })}
      />
    </li>
  );
}

export default function apply(ctx: Context) {
  function AlarmRunner() {
    useEffect(() => {
      const off = ctx.host.on(TOPICS.ring, (ring: RingPayload) => {
        playAlarmTone(ring.tone, ringLevel(ring.volume, ring.fadeIn, Date.now() - ring.firedAt, ring.ringMs));
      });
      return () => {
        void off();
      };
    }, []);
    return null;
  }

  function AlarmPage() {
    const { state, error, invoke } = useAlarm(ctx);
    const view = displayFor(state.settings);
    const [draft, setDraft] = useState<AlarmDraft>({ time: "08:30", label: "", days: DEFAULT_DAYS, tone: state.settings.defaultTone });
    const [toneTouched, setToneTouched] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const current = toneTouched ? draft : { ...draft, tone: state.settings.defaultTone };
    const patch = (next: Partial<AlarmDraft>) => {
      if (next.tone) setToneTouched(true);
      setDraft({ ...current, ...next });
    };

    function handleAdd() {
      if (!current.time) return;
      invoke(METHODS.add, { ...current, label: current.label.trim() });
      setDraft({ ...current, label: "" });
    }

    return (
      <div className="fuyu-alarm">
        <RingBanner state={state} view={view} invoke={invoke} />

        <div className="fuyu-alarm__form">
          <div className="fuyu-alarm__form-top">
            <TimeAndLabel draft={current} patch={patch} />
            <button type="button" className="fuyu-alarm__button" onClick={handleAdd}>
              {text.add}
            </button>
          </div>
          <button
            type="button"
            className="fuyu-alarm__summary"
            aria-expanded={optionsOpen}
            onClick={() => setOptionsOpen((open) => !open)}
          >
            {view.days(current.days)} · {text.tones[current.tone]} {optionsOpen ? "▾" : "▸"}
          </button>
          {optionsOpen && <DraftOptions draft={current} order={view.order} patch={patch} />}
        </div>

        {state.alarms.length === 0 ? (
          <p className="fuyu-alarm__note">{text.empty}</p>
        ) : (
          <ul className="fuyu-alarm__list">
            {state.alarms.map((alarm) =>
              editing === alarm.id ? (
                <li key={alarm.id}>
                  <AlarmEditor
                    initial={{ time: alarm.time, label: alarm.label, days: alarm.days, tone: alarm.tone }}
                    order={view.order}
                    onCancel={() => setEditing(null)}
                    onDelete={() => {
                      setEditing(null);
                      invoke(METHODS.remove, { id: alarm.id });
                    }}
                    onSave={(next) => {
                      setEditing(null);
                      invoke(METHODS.update, { id: alarm.id, ...next });
                    }}
                  />
                </li>
              ) : (
                <AlarmRow key={alarm.id} alarm={alarm} view={view} invoke={invoke} onEdit={() => setEditing(alarm.id)} />
              ),
            )}
          </ul>
        )}

        {error && <p className="fuyu-alarm__note">{error}</p>}
      </div>
    );
  }

  function AlarmCollapsed() {
    const { state } = useAlarm(ctx);
    const view = displayFor(state.settings);
    if (state.ringing) {
      return (
        <span className="fuyu-alarm-chip fuyu-alarm-chip--ringing" title={state.ringing.label || text.ringingNow}>
          <AlarmIcon size={12} />
          <span className="fuyu-alarm-chip__time">{view.time(state.ringing.time)}</span>
        </span>
      );
    }
    if (state.settings.barMode !== "always") return null;
    const next = nextScheduledAlarm(state.alarms, state.at || Date.now());
    if (!next) return null;
    return (
      <span className="fuyu-alarm-chip" title={next.alarm.label || text.title}>
        <AlarmIcon size={12} />
        <span className="fuyu-alarm-chip__time">{view.time(next.alarm.time)}</span>
      </span>
    );
  }

  ctx.slots.add("island.runner/v1", { id: "alarm-runner", component: AlarmRunner });
  ctx.slots.add("island.page/v1", { id: PAGE_ID, title: PAGE_TITLE, component: AlarmPage, icon: AlarmIcon });
  ctx.slots.add("island.collapsed/v1", { id: "alarm-bar", hideable: true, opens: PAGE_ID, component: AlarmCollapsed });
}
