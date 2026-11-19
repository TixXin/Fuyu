import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Check, Moon, RefreshCcw, Search, Sun } from "lucide-react";
import { IslandPreview } from "../../components/island-preview/IslandPreview";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { takePendingSection } from "../../lib/settings/sectionFocus";
import { activeTone, resolveThemeColors, type ThemeTone } from "../../lib/theme/themeMode";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import type { IslandSettings } from "../../lib/settings/types";
import { useLocale, useTranslation } from "../../i18n";
import { getThemeMarket } from "./api";
import { isDualMarketTheme, isThemeInUse, readMarketThemes, withMarketTheme, type MarketTheme } from "./model";
import "./ThemeMarketPage.css";

const OFFICIAL = "TixXin";
const SECTION = "themeMarket";

let lastThemes: MarketTheme[] | null = null;

type Filter = "all" | "official" | "dual";

export function ThemeMarketPage({ settings, onSettingsChange, onSave }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onSave: (theme: MarketTheme, settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.themeMarket;
  const { locale } = useLocale();
  const systemDark = useSystemDark();
  const defaultTone = activeTone(settings.themeMode, systemDark);
  const [themes, setThemes] = useState<MarketTheme[] | null>(lastThemes);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [previewTones, setPreviewTones] = useState<Readonly<Record<string, ThemeTone>>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(lastThemes !== null);
  const [jumped, setJumped] = useState(false);
  const section = useRef<HTMLElement>(null);

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
  useEffect(() => {
    if (!takePendingSection(SECTION)) return;
    setOpen(true);
    setJumped(true);
  }, []);
  useEffect(() => { if (open) void refresh(); }, [open, refresh]);
  useEffect(() => { if (jumped) section.current?.scrollIntoView({ block: "start" }); }, [jumped]);

  const looks = useMemo(() => (themes ?? []).map((theme) => ({ theme, dual: isDualMarketTheme(theme), applied: withMarketTheme(settings, theme) })), [themes, settings]);
  const shownLooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return looks.filter(({ theme, dual }) => {
      if (filter === "official" && theme.author !== OFFICIAL) return false;
      if (filter === "dual" && !dual) return false;
      if (!q) return true;
      const haystack = [theme.id, theme.name["zh-CN"], theme.name.en, theme.author ?? "", theme.description?.["zh-CN"] ?? "", theme.description?.en ?? ""].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [looks, query, filter]);
  const status = loading ? text.refreshing : themes ? text.status(themes.length) : "";

  if (!open) {
    return (
      <section ref={section} className="settings-group plugins-panel theme-market">
        <div className="settings-group__header"><h2 className="settings-group__title">{text.title}</h2></div>
        <div className="settings-group__card">
          <SettingsRow title={text.more} description={text.moreHint} control={<SettingsLinkButton onClick={() => setOpen(true)}>{text.browse}</SettingsLinkButton>} />
        </div>
      </section>
    );
  }

  return (
    <section ref={section} className="settings-group plugins-panel theme-market">
      <div className="settings-group__header"><h2 className="settings-group__title">{text.title}</h2></div>
      <div className="plugin-market__header">
        <span className="plugin-market__status" aria-live="polite">{status}</span>
        <div className="theme-market__toolbar">
          <label className="theme-market__search">
            <Search size={13} strokeWidth={2.2} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder={text.searchPlaceholder}
              aria-label={text.searchPlaceholder}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <SettingsChoice<Filter>
            value={filter}
            ariaLabel={text.filterAll}
            options={[
              { value: "all", label: text.filterAll },
              { value: "official", label: text.filterOfficial },
              { value: "dual", label: text.filterDual },
            ]}
            onChange={setFilter}
          />
          <button className="settings-button plugin-market__refresh" type="button" aria-label={text.refresh} disabled={loading} onClick={() => void refresh()}>
            <RefreshCcw className={loading ? "plugin-market__spin" : undefined} size={12} strokeWidth={2.4} />
          </button>
        </div>
      </div>
      {failed ? <p className="plugin-card__error" role="alert">{text.loadFailed}</p> : null}
      {themes === null && loading ? <p className="settings-section__hint">{text.loading}</p> : null}
      {themes !== null && themes.length === 0 && !failed ? <p className="settings-section__hint">{text.empty}</p> : null}
      {themes !== null && themes.length > 0 && shownLooks.length === 0 ? <p className="settings-section__hint">{text.noMatches}</p> : null}
      <div className="plugin-market__grid theme-market__grid">
        {shownLooks.map(({ theme, dual, applied }) => {
          const inUse = isThemeInUse(settings, theme);
          const official = theme.author === OFFICIAL;
          const tone: ThemeTone = dual ? (previewTones[theme.id] ?? defaultTone) : (applied.themeMode === "light" ? "light" : "dark");
          const preview = { ...resolveThemeColors(applied, tone === "dark", tone), collapsedDark: false };
          return (
            <article className="theme-market__item" key={theme.id} data-theme-id={theme.id} data-dual={dual ? "true" : undefined}>
              <IslandPreview settings={preview} compact />
              <div className="theme-market__text">
                <span className="theme-market__title">
                  <strong>{theme.name[locale]}</strong>
                  {official ? (
                    <span className="plugin-market__badge plugin-market__badge--official">
                      <BadgeCheck size={11} strokeWidth={2.4} aria-hidden="true" />
                      {text.official}
                    </span>
                  ) : theme.author ? <span className="theme-market__author">{text.by(theme.author)}</span> : null}
                  {dual ? <span className="plugin-market__badge theme-market__badge--dual">{text.dualBadge}</span> : null}
                </span>
                {theme.description ? <span className="theme-market__description">{theme.description[locale]}</span> : null}
              </div>
              <div className="theme-market__actions">
                {dual ? (
                  <div className="theme-market__tones" role="group" aria-label={text.dualBadge}>
                    <button
                      className="theme-market__tone"
                      type="button"
                      aria-label={text.previewDark}
                      aria-pressed={tone === "dark"}
                      onClick={() => setPreviewTones((current) => ({ ...current, [theme.id]: "dark" }))}
                    >
                      <Moon size={11} strokeWidth={2.2} aria-hidden="true" />
                      {text.darkTone}
                    </button>
                    <button
                      className="theme-market__tone"
                      type="button"
                      aria-label={text.previewLight}
                      aria-pressed={tone === "light"}
                      onClick={() => setPreviewTones((current) => ({ ...current, [theme.id]: "light" }))}
                    >
                      <Sun size={11} strokeWidth={2.2} aria-hidden="true" />
                      {text.lightTone}
                    </button>
                  </div>
                ) : null}
                <button
                  className="settings-button"
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
                  className="settings-button theme-market__apply"
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
      <div className="settings-group__footer">
        <SettingsFootnote text={text.hint} />
      </div>
    </section>
  );
}
