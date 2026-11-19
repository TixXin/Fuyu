import { useState } from "react";
import type { Display } from "./display.ts";
import { AlarmEditor } from "./editor.tsx";
import { METHODS, type AlarmItem } from "./model.ts";
import { text } from "./text.ts";

export function AlarmList({ alarms, view, invoke }: { alarms: AlarmItem[]; view: Display; invoke: (method: string, params?: unknown) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  if (alarms.length === 0) return <p className="fuyu-alarm-set__hint">{text.empty}</p>;
  return (
    <ul className="fuyu-alarm-set__alarms">
      {alarms.map((alarm) =>
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
          <li key={alarm.id} className={alarm.enabled ? "fuyu-alarm-set__alarm" : "fuyu-alarm-set__alarm is-off"}>
            <input
              type="checkbox"
              aria-label={alarm.enabled ? text.on : text.off}
              checked={alarm.enabled}
              onChange={() => invoke(METHODS.toggle, { id: alarm.id })}
            />
            <span className="fuyu-alarm-set__alarm-time">{view.time(alarm.time)}</span>
            <span className="fuyu-alarm-set__alarm-meta">
              {alarm.label ? `${alarm.label} · ` : ""}
              {view.days(alarm.days)} · {text.tones[alarm.tone]}
            </span>
            <button type="button" className="fuyu-alarm__mini" onClick={() => setEditing(alarm.id)}>
              {text.edit}
            </button>
            <button type="button" className="fuyu-alarm__mini fuyu-alarm__mini--danger" onClick={() => invoke(METHODS.remove, { id: alarm.id })}>
              {text.remove}
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
