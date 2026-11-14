import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "../../features/center-pattern/useReducedMotion";
import { resolveThemeColors, surfaceThemeColors } from "../../features/appearance/themeMode";
import type { IslandSettings } from "../../features/appearance/types";
import { useSystemDark } from "../../features/appearance/useResolvedTheme";
import { useTranslation } from "../../i18n";
import { dayPeriod } from "../../utils/dayPeriod";
import { FEATURE_PAGES, type SettingsFeature } from "./categories";
import { CATEGORY_ICONS } from "./SettingsSidebar";
import "./OverviewStage.css";

export type StageFeature = SettingsFeature | "messages";

const CYCLE_MS = 2_800;

export function OverviewStage({ settings, spot, playing }: { settings: IslandSettings; spot: StageFeature | null; playing: readonly StageFeature[] }) {
  const t = useTranslation();
  const text = t.settings.overview;
  const systemDark = useSystemDark();
  const reducedMotion = useReducedMotion();
  const [turn, setTurn] = useState(0);
  const cycling = spot === null && !reducedMotion && playing.length > 1;

  useEffect(() => {
    if (!cycling) return;
    const timer = window.setInterval(() => setTurn((value) => value + 1), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [cycling]);

  const shown = spot ?? (playing.length > 0 ? playing[turn % playing.length] : null);
  const Icon = shown ? CATEGORY_ICONS[shown === "messages" ? "messages" : FEATURE_PAGES[shown][0]] : null;
  const colors = surfaceThemeColors(resolveThemeColors(settings, systemDark), "collapsed");
  const island = {
    "--stage-fill": colors.islandBackgroundColor,
    "--stage-text": colors.taskTextColor,
    "--stage-dot": colors.pulseColor,
  } as CSSProperties;

  return (
    <section className="overview-stage" data-feature={shown ?? undefined}>
      <div className="overview-stage__island" style={island} aria-hidden="true">
        <i className="overview-stage__dot" />
        <span className="overview-stage__demo" key={shown ?? "idle"}>
          {Icon ? <Icon size={15} strokeWidth={2} /> : null}
          <span>{shown ? text.demo[shown] : t.settings.project.appName}</span>
        </span>
      </div>
      <div className="overview-stage__copy">
        <strong>{text.greeting[dayPeriod(new Date().getHours())]}</strong>
        <span>{playing.length > 0 ? text.summary(playing.length) : text.summaryNone}</span>
      </div>
    </section>
  );
}
