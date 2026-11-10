import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, RefreshCcw } from "lucide-react";
import { IslandPreview } from "../appearance/IslandPreview";
import type { IslandSettings } from "../appearance/types";
import { useLocale, useTranslation } from "../../i18n";
import { getThemeMarket } from "./api";
import { isThemeInUse, readMarketThemes, withMarketTheme, type MarketTheme } from "./model";
import "../plugins/PluginMarketSection.css";
import "../plugins/PluginCard.css";
import "./ThemeMarketPage.css";

/** The island's own publisher, shown as Official (OFFICIAL_PUBLISHER in plugin_host/market.rs). */
const OFFICIAL = "TixXin";

/** The themes this window last read, shown at once when the page opens again. */
let lastThemes: MarketTheme[] | null = null;

/**
 * Settings → Theme market (C26): themes from TixXin/fuyu-plugins, each a card with the collapsed
 * island drawn in it over the user's own sizes. Apply changes the look at once; Save adds it to
 * the Theme page's saved themes (`onSave` takes a theme file's text, as an import does).
 */
export function ThemeMarketPage({ settings, onSettingsChange, onSave }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onSave: (theme: MarketTheme, settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.themeMarket;
  const { locale } = useLocale();
  const [themes, setThemes] = useState<MarketTheme[] | null>(lastThemes);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const next = readMarketThemes(await getThemeMarket());
      lastThemes = next;
      setThemes(next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const looks = useMemo(() => (themes ?? []).map((theme) => ({ theme, applied: withMarketTheme(settings, theme) })), [themes, settings]);
  const status = loading ? text.refreshing : themes ? text.status(themes.length) : "";

  return (
    <section className="settings-section settings-section--list plugins-panel theme-market">
      <div className="plugin-market__header">
        <span className="plugin-market__status" aria-live="polite">{status}</span>
        <button className="plugin-card__button plugin-market__refresh" type="button" aria-label={text.refresh} disabled={loading} onClick={() => void refresh()}>
          <RefreshCcw className={loading ? "plugin-market__spin" : undefined} size={12} strokeWidth={2.4} />
        </button>
      </div>
      {failed ? <p className="plugin-card__error" role="alert">{text.loadFailed}</p> : null}
      {themes === null && loading ? <p className="settings-section__hint">{text.loading}</p> : null}
      {themes !== null && themes.length === 0 && !failed ? <p className="settings-section__hint">{text.empty}</p> : null}
      <div className="plugin-market__grid theme-market__grid">
        {looks.map(({ theme, applied }) => {
          const inUse = isThemeInUse(settings, theme);
          const official = theme.author === OFFICIAL;
          return (
            <article className="theme-market__item" key={theme.id} data-theme-id={theme.id}>
              <IslandPreview settings={applied} compact />
              <div className="theme-market__text">
                <span className="theme-market__title">
                  <strong>{theme.name[locale]}</strong>
                  {official ? (
                    <span className="plugin-market__badge plugin-market__badge--official">
                      <BadgeCheck size={11} strokeWidth={2.4} aria-hidden="true" />
                      {text.official}
                    </span>
                  ) : theme.author ? <span className="theme-market__author">{text.by(theme.author)}</span> : null}
                </span>
                {theme.description ? <span className="theme-market__description">{theme.description[locale]}</span> : null}
              </div>
              <div className="theme-market__actions">
                <button
                  className="plugin-card__button"
                  type="button"
                  disabled={saved.has(theme.id)}
                  onClick={() => {
                    onSave(theme, applied);
                    setSaved((current) => new Set(current).add(theme.id));
                  }}
                >
                  {saved.has(theme.id) ? text.saved : text.save}
                </button>
                <button
                  className="plugin-card__button theme-market__apply"
                  type="button"
                  aria-pressed={inUse}
                  disabled={inUse}
                  onClick={() => onSettingsChange(applied)}
                >
                  {inUse ? <><Check size={12} strokeWidth={2.6} aria-hidden="true" />{text.inUse}</> : text.apply}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="settings-section__hint">{text.hint}</p>
    </section>
  );
}
