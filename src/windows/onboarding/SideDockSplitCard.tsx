import { useEffect, useRef, useState } from "react";
import { Columns3, Eye, EyeOff, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { useTranslation } from "../../i18n";
import { loadIslandPages, saveIslandPages, setIslandPagePlacement } from "../../lib/settings/islandPages";
import {
  applySideDockSplitPreset,
  DEFAULT_SIDE_DOCKS,
  SIDE_DOCK_LEFT_PAGES,
  SIDE_DOCK_RECOMMENDED_PAGES,
  SIDE_DOCK_TOP_CORE_PAGES,
} from "../../lib/settings/sideDocks";
import { useSideDocks } from "../../lib/settings/useSideDocks";
import { previewSideDock } from "../side-dock/api";
import "./SideDockSplitCard.css";

const AUTO_FOLD_MS = 2600;
const SPAWN_DELAY_MS = 400;

export function SideDockSplitCard({
  onUserInteract,
  onOpenSettings,
}: {
  onUserInteract?: () => void;
  onOpenSettings?: () => void;
}) {
  const text = useTranslation().onboarding.sideDockSplit;
  const { settings: sideDocks, save: saveSideDocks } = useSideDocks();
  const [previewing, setPreviewing] = useState(false);
  const timerRef = useRef<number>(0);
  const foldTimerRef = useRef<number>(0);

  const splitActive = sideDocks.left.enabled || sideDocks.right.enabled;

  const stopPreview = () => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(foldTimerRef.current);
    timerRef.current = 0;
    foldTimerRef.current = 0;
    setPreviewing(false);
    void previewSideDock("left", false).catch(() => undefined);
    void previewSideDock("right", false).catch(() => undefined);
  };

  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(foldTimerRef.current);
    void previewSideDock("left", false).catch(() => undefined);
    void previewSideDock("right", false).catch(() => undefined);
  }, []);

  const openBothWings = (autoFold: boolean) => {
    setPreviewing(true);
    void previewSideDock("left", true).catch(() => undefined);
    void previewSideDock("right", true).catch(() => undefined);
    if (autoFold) {
      window.clearTimeout(foldTimerRef.current);
      foldTimerRef.current = window.setTimeout(() => {
        stopPreview();
      }, AUTO_FOLD_MS);
    }
  };

  const applySplit = () => {
    onUserInteract?.();
    window.clearTimeout(timerRef.current);
    window.clearTimeout(foldTimerRef.current);
    const wasBoth = sideDocks.left.enabled && sideDocks.right.enabled;
    const applied = applySideDockSplitPreset(sideDocks, loadIslandPages());
    saveIslandPages(applied.layout);
    saveSideDocks(applied.settings);
    if (wasBoth) {
      openBothWings(true);
    } else {
      setPreviewing(true);
      timerRef.current = window.setTimeout(() => openBothWings(true), SPAWN_DELAY_MS);
    }
  };

  const resetToTop = () => {
    onUserInteract?.();
    stopPreview();
    let nextLayout = loadIslandPages();
    for (const id of [...SIDE_DOCK_TOP_CORE_PAGES, ...SIDE_DOCK_RECOMMENDED_PAGES, ...SIDE_DOCK_LEFT_PAGES]) {
      nextLayout = setIslandPagePlacement(nextLayout, id, "top");
    }
    saveIslandPages(nextLayout);
    saveSideDocks({
      ...sideDocks,
      left: { ...DEFAULT_SIDE_DOCKS.left },
      right: { ...DEFAULT_SIDE_DOCKS.right },
    });
  };

  const togglePreview = () => {
    onUserInteract?.();
    if (previewing) {
      stopPreview();
      return;
    }
    if (!splitActive) {
      applySplit();
      return;
    }
    openBothWings(false);
  };

  return (
    <div className={splitActive ? "side-dock-split side-dock-split--active" : "side-dock-split"} data-side-dock-split={splitActive ? "on" : "off"}>
      <div className="side-dock-split__top">
        <div className="side-dock-split__title-wrap">
          <span className="side-dock-split__icon" aria-hidden="true">
            <Columns3 size={15} />
          </span>
          <div className="side-dock-split__copy">
            <div className="side-dock-split__title">
              <span>{text.title}</span>
              <span className={splitActive ? "side-dock-split__badge side-dock-split__badge--on" : "side-dock-split__badge"}>
                {splitActive ? text.activeBadge : text.recommendedBadge}
              </span>
            </div>
            <p className="side-dock-split__desc">{text.desc}</p>
          </div>
        </div>
        <div className="side-dock-split__actions">
          {splitActive ? (
            <button type="button" className="onboarding__chip-btn" data-action="side-dock-reset" onClick={resetToTop}>
              <RotateCcw size={11} aria-hidden="true" />
              {text.resetBtn}
            </button>
          ) : (
            <button
              type="button"
              className="onboarding__chip-btn onboarding__chip-btn--active"
              data-action="side-dock-split"
              onClick={applySplit}
            >
              <Sparkles size={11} aria-hidden="true" />
              {text.splitBtn}
            </button>
          )}
          <button
            type="button"
            className={previewing ? "onboarding__chip-btn onboarding__chip-btn--active" : "onboarding__chip-btn"}
            data-action="side-dock-preview"
            onClick={togglePreview}
          >
            {previewing ? <EyeOff size={11} aria-hidden="true" /> : <Eye size={11} aria-hidden="true" />}
            {previewing ? text.stopPreviewBtn : text.previewBtn}
          </button>
          {onOpenSettings && (
            <button type="button" className="onboarding__chip-btn" onClick={onOpenSettings}>
              <Settings2 size={11} aria-hidden="true" />
              {text.tuneBtn}
            </button>
          )}
        </div>
      </div>

      <div className="side-dock-split__zones" aria-label={text.zonesLabel}>
        <div className={sideDocks.left.enabled ? "side-dock-split__zone side-dock-split__zone--on" : "side-dock-split__zone"}>
          <span className="side-dock-split__zone-name">{text.zoneLeft}</span>
          <span className="side-dock-split__zone-items">{text.zoneLeftItems}</span>
        </div>
        <div className="side-dock-split__zone side-dock-split__zone--top">
          <span className="side-dock-split__zone-name">{text.zoneTop}</span>
          <span className="side-dock-split__zone-items">{text.zoneTopItems}</span>
        </div>
        <div className={sideDocks.right.enabled ? "side-dock-split__zone side-dock-split__zone--on" : "side-dock-split__zone"}>
          <span className="side-dock-split__zone-name">{text.zoneRight}</span>
          <span className="side-dock-split__zone-items">{text.zoneRightItems}</span>
        </div>
      </div>
    </div>
  );
}
