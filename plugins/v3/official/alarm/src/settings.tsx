import type { Context } from "@fuyu/plugin-base";
import { playAlarmTone } from "./chime.ts";
import { ALARM_TONES, METHODS, type AlarmTone } from "./model.ts";
import { text } from "./text.ts";
import { useAlarm } from "./useAlarm.ts";
import "./styles.css";

export default function apply(ctx: Context) {
  function AlarmSection() {
    const { state, error, invoke } = useAlarm(ctx);
    const activeCount = state.alarms.filter((item) => item.enabled).length;

    return (
      <section className="fuyu-alarm">
        <div className="fuyu-alarm__settings-row">
          <div className="fuyu-alarm__row-main">
            <h3 className="fuyu-alarm__section-title">{text.title}</h3>
            <p className="fuyu-alarm__note">{text.summary(state.alarms.length, activeCount)}</p>
          </div>
          <div className="fuyu-alarm__ring-actions">
            <label className="fuyu-alarm__toggle">
              <span>{text.defaultTone}</span>
              <select
                className="fuyu-alarm__select"
                value={state.defaultTone}
                onChange={(e) => invoke(METHODS.setSettings, { defaultTone: e.target.value as AlarmTone })}
              >
                {ALARM_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {text.tones[tone]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="fuyu-alarm__mini" onClick={() => playAlarmTone(state.defaultTone)}>
              {text.preview}
            </button>
          </div>
        </div>
        <label className="fuyu-alarm__toggle">
          <input
            type="checkbox"
            checked={state.showInBar}
            onChange={(e) => invoke(METHODS.setSettings, { showInBar: e.target.checked })}
          />
          <span>{text.showInBar}</span>
        </label>
        {error && <p className="fuyu-alarm__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "alarm", category: "pluginsV3", component: AlarmSection });
}
