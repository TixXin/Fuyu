import type { Context } from "@fuyu/plugin-base";
import { METHODS } from "./model.ts";
import { text } from "./text.ts";
import { useWorldClock } from "./useWorldClock.ts";
import "./styles.css";

export default function apply(ctx: Context) {
  function WorldClockSection() {
    const { state, error, invoke } = useWorldClock(ctx);
    return (
      <section className="fuyu-world-clock">
        <div className="fuyu-world-clock__settings-row">
          <div className="fuyu-world-clock__city">
            <h3 className="fuyu-world-clock__section-title">{text.title}</h3>
            <p className="fuyu-world-clock__note">{text.summary(state.cities.length)}</p>
          </div>
          <label className="fuyu-world-clock__toggle">
            <input
              type="checkbox"
              checked={state.showInBar}
              onChange={(e) => invoke(METHODS.setShowInBar, { showInBar: e.target.checked })}
            />
            <span>{text.showInBar}</span>
          </label>
        </div>
        {error && <p className="fuyu-world-clock__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "world-clock", category: "pluginsV3", component: WorldClockSection });
}
