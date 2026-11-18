import type { Context } from "@fuyu/plugin-base";
import { METHODS } from "./model.ts";
import { text } from "./text.ts";
import { useCountdown } from "./useCountdown.ts";
import "./styles.css";

export default function apply(ctx: Context) {
  function CountdownSection() {
    const { state, error, invoke } = useCountdown(ctx);
    return (
      <section className="fuyu-countdown">
        <div className="fuyu-countdown__settings-row">
          <div className="fuyu-countdown__row-info">
            <h3 className="fuyu-countdown__section-title">{text.title}</h3>
            <p className="fuyu-countdown__note">
              {text.countSummary(state.items.length)} · {text.showInBarHint}
            </p>
          </div>
          <label className="fuyu-countdown__toggle">
            <input
              type="checkbox"
              checked={state.showInBar}
              onChange={(e) => invoke(METHODS.setShowInBar, { showInBar: e.target.checked })}
            />
            <span>{text.showInBar}</span>
          </label>
        </div>
        {error && <p className="fuyu-countdown__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "countdown", category: "pluginsV3", component: CountdownSection });
}
