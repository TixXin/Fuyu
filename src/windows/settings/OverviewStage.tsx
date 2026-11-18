import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { resolveThemeColors, surfaceThemeColors } from "../../lib/theme/themeMode";
import type { IslandSettings } from "../../lib/settings/types";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import { useTranslation } from "../../i18n";
import { dayPeriod } from "../../utils/dayPeriod";
import { FEATURE_PAGES, type SettingsFeature } from "./categories";
import { CATEGORY_ICONS } from "./SettingsSidebar";
import "./OverviewStage.css";

export type StageFeature = SettingsFeature | "behaviorAlerts" | "messages";

const CYCLE_MS = 2_800;

export function OverviewStage({ settings, spot, playing, onCount }: { settings: IslandSettings; spot: StageFeature | null; playing: readonly StageFeature[]; onCount: number }) {
  const t = useTranslation();
  const text = t.settings.overview;
  const systemDark = useSystemDark();
  const reducedMotion = useReducedMotion();
  const [turn, setTurn] = useState(0);
  const cycling = spot === null && !reducedMotion && playing.length > 1;

  useEffect(() => {
    if (!cycling) return;
    return visibilityInterval(() => setTurn((value) => value + 1), CYCLE_MS);
  }, [cycling]);

  const shown = spot ?? (playing.length > 0 ? playing[turn % playing.length] : null);
  const Icon = shown ? CATEGORY_ICONS[shown === "messages" ? "messages" : shown === "behaviorAlerts" ? "behaviorAlerts" : FEATURE_PAGES[shown][0]] : null;
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
        <span>{onCount > 0 ? text.summary(onCount) : text.summaryNone}</span>
      </div>
    </section>
  );
}
