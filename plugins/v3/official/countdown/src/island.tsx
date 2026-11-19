import type { Context } from "@fuyu/plugin-base";
import { CalendarIcon, ChevronIcon } from "./icons.tsx";
import { barLabel, heroLabel, rowLabel } from "./labels.ts";
import { barItem, pageView, readingOf, type CountdownItem, type CountdownSettings } from "./model.ts";
import { PAGE_TITLE, text } from "./text.ts";
import { useBackground, useCountdown, useToday } from "./useCountdown.ts";
import "./styles.css";

const PAGE_ID = "countdown";

type SettingsOpener = { settings?: { open?: () => unknown } };

function settingsOpener(ctx: Context): (() => unknown) | null {
  const open = (ctx as unknown as SettingsOpener).settings?.open;
  return typeof open === "function" ? () => open.call((ctx as unknown as SettingsOpener).settings) : null;
}

function Hero({ ctx, item, at, settings }: { ctx: Context; item: CountdownItem; at: number; settings: CountdownSettings }) {
  const background = useBackground(ctx, item.id, item.bgRev);
  const reading = readingOf(item, at);
  const dim = reading.type === "past" && settings.pastMode === "dim";
  const className = ["fuyu-countdown__hero", background ? "fuyu-countdown__hero--image" : "", dim ? "is-dim" : ""].filter(Boolean).join(" ");
  return (
    <div className={className} style={background ? { backgroundImage: `url(${background})` } : undefined}>
      <div className="fuyu-countdown__hero-shade">
        <div className="fuyu-countdown__hero-main">
          <span className="fuyu-countdown__hero-title">{item.title}</span>
          {settings.showDate && <span className="fuyu-countdown__hero-date">{item.date}</span>}
        </div>
        <span className="fuyu-countdown__hero-days">{heroLabel(reading)}</span>
      </div>
    </div>
  );
}

function Row({ item, at, settings }: { item: CountdownItem; at: number; settings: CountdownSettings }) {
  const reading = readingOf(item, at);
  const dim = reading.type === "past" && settings.pastMode === "dim";
  return (
    <li className={dim ? "fuyu-countdown__row is-dim" : "fuyu-countdown__row"}>
      <span className="fuyu-countdown__row-title">{item.title}</span>
      {settings.showDate && <span className="fuyu-countdown__row-date">{item.date}</span>}
      <span className="fuyu-countdown__row-days">{rowLabel(reading)}</span>
    </li>
  );
}

export default function apply(ctx: Context) {
  const openSettings = settingsOpener(ctx);

  function CountdownPage() {
    const { state, error } = useCountdown(ctx);
    const at = useToday();
    const { settings } = state;
    const view = pageView(state.items, settings, at);
    return (
      <div className="fuyu-countdown">
        {view.hero ? (
          <>
            <Hero ctx={ctx} item={view.hero} at={at} settings={settings} />
            {view.rows.length > 0 && (
              <ul className="fuyu-countdown__list">
                {view.rows.map((item) => (
                  <Row key={item.id} item={item} at={at} settings={settings} />
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="fuyu-countdown__note">{text.empty}</p>
        )}
        {(openSettings || view.hidden > 0) && (
          <div className="fuyu-countdown__foot">
            <span className="fuyu-countdown__note">{view.hidden > 0 ? text.more(view.hidden) : ""}</span>
            {openSettings && (
              <button type="button" className="fuyu-countdown__manage" onClick={() => void openSettings()}>
                {text.manage}
                <ChevronIcon />
              </button>
            )}
          </div>
        )}
        {error && <p className="fuyu-countdown__note">{error}</p>}
      </div>
    );
  }

  function CountdownCollapsed() {
    const { state } = useCountdown(ctx);
    const at = useToday();
    const { settings } = state;
    if (!settings.showInBar) return null;
    const item = barItem(state.items, settings, at);
    if (!item) return null;
    const label = barLabel(readingOf(item, at));
    return (
      <span className="fuyu-countdown-chip" title={`${item.title} · ${rowLabel(readingOf(item, at))}`}>
        {settings.barStyle === "icon" && <CalendarIcon size={12} />}
        {settings.barStyle === "title" && <span className="fuyu-countdown-chip__title">{item.title}</span>}
        <span className="fuyu-countdown-chip__days">{label}</span>
      </span>
    );
  }

  ctx.slots.add("island.page/v1", { id: PAGE_ID, title: PAGE_TITLE, component: CountdownPage, icon: CalendarIcon });
  ctx.slots.add("island.collapsed/v1", {
    id: "countdown-bar",
    width: 110,
    hideable: true,
    opens: PAGE_ID,
    component: CountdownCollapsed,
  });
}
