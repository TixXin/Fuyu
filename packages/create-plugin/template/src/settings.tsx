import type { Context } from "@fuyu/plugin-base";
import { text } from "./text.ts";
import { METHODS, isTicking } from "./timers.ts";
import { useTimers } from "./useTimers.ts";
import "./styles.css";

export default function apply(ctx: Context) {
  function Section() {
    const { list, error, call } = useTimers(ctx);
    const running = list.timers.filter((timer) => isTicking(timer, list.at)).length;
    const ringing = list.timers.filter((timer) => timer.alerted).length;
    return (
      <section className="{{css}}">
        <h3 className="{{css}}__title">{text.title}</h3>
        <p className="{{css}}__note">{text.summary(list.timers.length, running)}</p>
        <button type="button" className="{{css}}__button" disabled={ringing === 0} onClick={() => call(METHODS.dismiss)}>
          {text.dismiss(ringing)}
        </button>
        {error && <p className="{{css}}__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "{{name}}", category: "pluginsV3", component: Section });
}
