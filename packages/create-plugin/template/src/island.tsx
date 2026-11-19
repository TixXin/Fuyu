import type { Context } from "@fuyu/plugin-base";
import { text } from "./text.ts";
import { COUNTDOWN_MS, METHODS, formatMs, shownMs } from "./timers.ts";
import { useTimers } from "./useTimers.ts";
import "./styles.css";

function TimerIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M10 2h4" />
    </svg>
  );
}

export default function apply(ctx: Context) {
  function Page() {
    const { list, error, call } = useTimers(ctx);
    return (
      <div className="{{css}}">
        <button type="button" className="{{css}}__button" onClick={() => call(METHODS.start)}>
          {text.start(formatMs(COUNTDOWN_MS))}
        </button>
        {list.timers.length === 0 ? (
          <p className="{{css}}__note">{text.empty}</p>
        ) : (
          <ul className="{{css}}__list">
            {list.timers.map((timer) => (
              <li key={timer.id} className="{{css}}__row">
                <span className="{{css}}__label">{text.kind[timer.kind]}</span>
                <span className="{{css}}__time">{formatMs(shownMs(timer, list.at))}</span>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="{{css}}__note">{error}</p>}
      </div>
    );
  }

  ctx.slots.add("island.page/v1", {
    id: "{{name}}",
    title: { "zh-CN": "{{displayNameZh}}", en: "{{displayNameEn}}" },
    component: Page,
    icon: TimerIcon,
  });
}
