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

type SettingsOpener = { settings?: { open?: () => unknown } };

function settingsOpener(ctx: Context): (() => unknown) | null {
  const holder = (ctx as unknown as SettingsOpener).settings;
  const open = holder?.open;
  return typeof open === "function" ? () => open.call(holder) : null;
}

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

function PlusIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SettingsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function ChevronIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
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
      <button
        type="button"
        role="switch"
        aria-checked={alarm.enabled}
        aria-label={alarm.enabled ? text.on : text.off}
        className={alarm.enabled ? "fuyu-alarm__toggle is-on" : "fuyu-alarm__toggle"}
        onClick={() => invoke(METHODS.toggle, { id: alarm.id })}
      >
        <span className="fuyu-alarm__toggle-thumb" />
      </button>
    </li>
  );
}

export default function apply(ctx: Context) {
  const openSettings = settingsOpener(ctx);

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
    const [composerOpen, setComposerOpen] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const current = toneTouched ? draft : { ...draft, tone: state.settings.defaultTone };
    const next = nextScheduledAlarm(state.alarms, state.at || Date.now());
    const patch = (nextDraft: Partial<AlarmDraft>) => {
      if (nextDraft.tone) setToneTouched(true);
      setDraft({ ...current, ...nextDraft });
    };

    function handleAdd() {
      if (!current.time) return;
      invoke(METHODS.add, { ...current, label: current.label.trim() });
      setDraft({ ...current, label: "" });
      setComposerOpen(false);
      setOptionsOpen(false);
    }

    return (
      <div className="fuyu-alarm">
        <RingBanner state={state} view={view} invoke={invoke} />

        <div className="fuyu-alarm__toolbar">
          <span className="fuyu-alarm__headline">
            {next ? text.nextAt(view.time(next.alarm.time)) : state.alarms.length > 0 ? text.allOff : text.title}
          </span>
          <div className="fuyu-alarm__actions">
            <button
              type="button"
              className={composerOpen ? "fuyu-alarm__add-toggle is-on" : "fuyu-alarm__add-toggle"}
              aria-expanded={composerOpen}
              onClick={() => setComposerOpen((open) => !open)}
            >
              <PlusIcon size={12} />
              <span>{text.newAlarm}</span>
            </button>
            {openSettings && (
              <button
                type="button"
                className="fuyu-alarm__icon-btn"
                title={text.settingsTip}
                aria-label={text.settingsTip}
                onClick={() => void openSettings()}
              >
                <SettingsIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {state.sample && state.alarms.length > 0 && (
          <div className="fuyu-alarm__sample">
            <span className="fuyu-alarm__sample-text">{text.sampleNotice}</span>
            {openSettings && (
              <button type="button" className="fuyu-alarm__sample-btn" onClick={() => void openSettings()}>
                <span>{text.customize}</span>
                <ChevronIcon size={12} />
              </button>
            )}
          </div>
        )}

        {composerOpen && (
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
        )}

        {state.alarms.length === 0 ? (
          <div className="fuyu-alarm__empty">
            <span className="fuyu-alarm__empty-icon" aria-hidden="true">
              <AlarmIcon size={20} />
            </span>
            <p className="fuyu-alarm__note">{text.empty}</p>
            <div className="fuyu-alarm__empty-actions">
              <button type="button" className="fuyu-alarm__button" onClick={() => setComposerOpen(true)}>
                {text.add}
              </button>
              <button type="button" className="fuyu-alarm__mini" onClick={() => invoke(METHODS.restoreSample)}>
                {text.loadSample}
              </button>
            </div>
          </div>
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
                    onSave={(nextDraft) => {
                      setEditing(null);
                      invoke(METHODS.update, { id: alarm.id, ...nextDraft });
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
