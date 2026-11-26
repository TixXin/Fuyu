import type { Context } from "@fuyu/plugin-base";
import { CalendarIcon, ChevronIcon, SettingsIcon } from "./icons.tsx";
import { barLabel, formatItemDate, heroLabel, rowLabel } from "./labels.ts";
import { METHODS, barItem, pageView, readingOf, type CountdownItem, type CountdownSettings } from "./model.ts";
import { PAGE_TITLE, text } from "./text.ts";
import { useBackground, useCountdown, useToday } from "./useCountdown.ts";
import "./styles.css";

const PAGE_ID = "countdown";

type SettingsOpener = { settings?: { open?: () => unknown } };

function settingsOpener(ctx: Context): (() => unknown) | null {
  const open = (ctx as unknown as SettingsOpener).settings?.open;
  return typeof open === "function" ? () => open.call((ctx as unknown as SettingsOpener).settings) : null;
}

function Hero({
  item,
  at,
  settings,
  background,
  onSettings,
}: {
  item: CountdownItem;
  at: number;
  settings: CountdownSettings;
  background: string | null;
  onSettings: (() => unknown) | null;
}) {
  const reading = readingOf(item, at);
  const dim = reading.type === "past" && settings.pastMode === "dim";
  const className = ["fuyu-countdown__hero", background ? "fuyu-countdown__hero--image" : "", dim ? "is-dim" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={className} style={background ? { backgroundImage: `url(${background})` } : undefined}>
      <div className="fuyu-countdown__hero-shade">
        <div className="fuyu-countdown__hero-main">
          <span className="fuyu-countdown__hero-title">{item.title}</span>
          {settings.showDate && <span className="fuyu-countdown__hero-date">{formatItemDate(item, at)}</span>}
        </div>
        <div className="fuyu-countdown__hero-right">
          <span className="fuyu-countdown__hero-days">{heroLabel(reading)}</span>
          {onSettings && (
            <button
              type="button"
              className="fuyu-countdown__hero-edit"
              title={text.settingsTip}
              aria-label={text.settingsTip}
              onClick={() => void onSettings()}
            >
              <SettingsIcon size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ item, at, settings }: { item: CountdownItem; at: number; settings: CountdownSettings }) {
  const reading = readingOf(item, at);
  const dim = reading.type === "past" && settings.pastMode === "dim";
  const kindClass = reading.type === "today" ? " is-today" : reading.type === "day" ? " is-anniv" : "";
  return (
    <li className={dim ? "fuyu-countdown__row is-dim" : "fuyu-countdown__row"}>
      <span className="fuyu-countdown__row-title">{item.title}</span>
      {settings.showDate && <span className="fuyu-countdown__row-date">{formatItemDate(item, at, false)}</span>}
      <span className={`fuyu-countdown__row-days${kindClass}`}>{rowLabel(reading)}</span>
    </li>
  );
}

export default function apply(ctx: Context) {
  const openSettings = settingsOpener(ctx);

  function CountdownPage() {
    const { state, error, invoke } = useCountdown(ctx);
    const at = useToday();
    const { settings } = state;
    const view = pageView(state.items, settings, at);
    const heroBg = useBackground(ctx, view.hero?.id ?? null, view.hero?.bgRev ?? null);
    return (
      <div className="fuyu-countdown">
        {state.sample && openSettings && view.hero && (
          <div className="fuyu-countdown__sample">
            <span className="fuyu-countdown__sample-text">{text.sampleNotice}</span>
            <button type="button" className="fuyu-countdown__sample-btn" onClick={() => void openSettings()}>
              <span>{text.customize}</span>
              <ChevronIcon size={12} />
            </button>
          </div>
        )}
        {view.hero ? (
          <>
            <Hero item={view.hero} at={at} settings={settings} background={heroBg} onSettings={openSettings} />
            {view.rows.length > 0 && (
              <ul className="fuyu-countdown__list">
                {view.rows.map((item) => (
                  <Row key={item.id} item={item} at={at} settings={settings} />
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="fuyu-countdown__empty">
            <span className="fuyu-countdown__empty-icon" aria-hidden="true">
              <CalendarIcon size={20} />
            </span>
            <p className="fuyu-countdown__note">{openSettings ? text.noItems : text.empty}</p>
            <div className="fuyu-countdown__empty-actions">
              {openSettings && (
                <button type="button" className="fuyu-countdown__go" onClick={() => void openSettings()}>
                  {text.goSettings}
                </button>
              )}
              <button type="button" className="fuyu-countdown__secondary" onClick={() => invoke(METHODS.restoreSample)}>
                {text.loadSample}
              </button>
            </div>
          </div>
        )}
        {view.hero && (openSettings || view.hidden > 0) && (
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
    hideable: true,
    opens: PAGE_ID,
    component: CountdownCollapsed,
  });
}
