import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { SIDE_DOCK_LIMITS, type SideDockEdge, type SideDocksSettings } from "../../../lib/settings/sideDocks";
import { previewSideDock } from "../../side-dock/api";
import "./SideDockMonitorStage.css";

type SideDockMonitorStageProps = {
  sideDocks: SideDocksSettings;
  saveSideDocks: (next: SideDocksSettings) => void;
};

const SIZE_PRESETS = [
  { key: "compact", width: 330, height: 470 },
  { key: "standard", width: 380, height: 540 },
  { key: "wide", width: 440, height: 600 },
] as const;

export function SideDockMonitorStage({ sideDocks, saveSideDocks }: SideDockMonitorStageProps) {
  const text = useTranslation().settings.islandPages.sideDocks;
  const [dual, setDual] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<SideDockEdge>("right");
  const [previewEdge, setPreviewEdge] = useState<SideDockEdge | null>(null);
  const [snappedCenter, setSnappedCenter] = useState(false);
  const primaryBoxRef = useRef<HTMLDivElement>(null);
  const secondaryBoxRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef(sideDocks);
  latestRef.current = sideDocks;

  const activeEdge: SideDockEdge =
    sideDocks[selectedEdge].enabled || (!sideDocks.left.enabled && !sideDocks.right.enabled)
      ? selectedEdge
      : sideDocks.right.enabled
        ? "right"
        : "left";

  useEffect(() => {
    return () => {
      void previewSideDock("left", false).catch(() => undefined);
      void previewSideDock("right", false).catch(() => undefined);
    };
  }, []);

  const togglePreview = () => {
    if (previewEdge === activeEdge) {
      setPreviewEdge(null);
      void previewSideDock(activeEdge, false).catch(() => undefined);
      return;
    }
    if (previewEdge) {
      void previewSideDock(previewEdge, false).catch(() => undefined);
    }
    const wasEnabled = sideDocks[activeEdge].enabled;
    if (!wasEnabled) {
      saveSideDocks({
        ...sideDocks,
        [activeEdge]: { ...sideDocks[activeEdge], enabled: true },
      });
    }
    setPreviewEdge(activeEdge);
    if (wasEnabled) {
      void previewSideDock(activeEdge, true).catch(() => undefined);
    } else {
      window.setTimeout(() => {
        void previewSideDock(activeEdge, true).catch(() => undefined);
      }, 360);
    }
  };

  const sideConfig = sideDocks[activeEdge];
  const scaleW = Math.round((sideDocks.drawerWidth / 1280) * 280);
  const scaleH = Math.round((sideDocks.drawerHeight / 720) * 186);
  const topPx = Math.max(10, Math.min(186 - scaleH - 10, Math.round(sideConfig.along * 186 - scaleH / 2)));
  const previewOffset = sideDocks.stages === 3 ? 12 + Math.round(sideDocks.gap * 0.45) : 0;

  const startDragHandle = (edge: SideDockEdge, targetBox: HTMLDivElement | null) => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setSelectedEdge(edge);
    const rect = targetBox?.getBoundingClientRect();
    if (!rect) return;
    const [minAlong, maxAlong] = SIDE_DOCK_LIMITS.along;
    const onMove = (moveEvent: PointerEvent) => {
      let along = (moveEvent.clientY - rect.top) / rect.height;
      along = Math.max(minAlong, Math.min(maxAlong, along));
      if (Math.abs(along - 0.5) < 0.035) {
        along = 0.5;
        setSnappedCenter(true);
      } else {
        setSnappedCenter(false);
      }
      const latest = latestRef.current;
      saveSideDocks({
        ...latest,
        [edge]: { ...latest[edge], along: Number(along.toFixed(2)) },
      });
    };
    const onUp = () => {
      setSnappedCenter(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startResizeWidth = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startW = latestRef.current.drawerWidth;
    const dir = activeEdge === "right" ? -1 : 1;
    const [minW, maxW] = SIDE_DOCK_LIMITS.drawerWidth;
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.round((startW + (moveEvent.clientX - startX) * dir * 3.5) / 10) * 10;
      const latest = latestRef.current;
      saveSideDocks({ ...latest, drawerWidth: Math.max(minW, Math.min(maxW, next)) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startResizeHeight = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startH = latestRef.current.drawerHeight;
    const [minH, maxH] = SIDE_DOCK_LIMITS.drawerHeight;
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.round((startH + (moveEvent.clientY - startY) * 3.0) / 10) * 10;
      const latest = latestRef.current;
      saveSideDocks({ ...latest, drawerHeight: Math.max(minH, Math.min(maxH, next)) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const edgeName = activeEdge === "right" ? text.zones.right : text.zones.left;
  const drawerRadius = Math.max(4, Math.round(sideDocks.outerRadius * 0.45));
  const previewing = previewEdge === activeEdge;

  return (
    <div className="sd-block">
      <div className="sd-block__head">
        <div>
          <h4 className="sd-block__subtitle">{text.monitor.title}</h4>
          <p className="sd-block__hint">{text.monitor.hint}</p>
        </div>
        <div className="sd-monitor-controls">
          <button
            type="button"
            className={`sd-btn sd-preview-btn${previewing ? " sd-btn--accent" : ""}`}
            onClick={togglePreview}
          >
            {previewing ? <EyeOff size={13} strokeWidth={1.7} aria-hidden="true" /> : <Eye size={13} strokeWidth={1.7} aria-hidden="true" />}
            <span>{previewing ? text.monitor.previewClose : text.monitor.previewOpen}</span>
          </button>
          <div className="sd-seg">
            <button type="button" className="sd-seg__btn" data-on={activeEdge === "left"} onClick={() => setSelectedEdge("left")}>
              {text.zones.left}
            </button>
            <button type="button" className="sd-seg__btn" data-on={activeEdge === "right"} onClick={() => setSelectedEdge("right")}>
              {text.zones.right}
            </button>
          </div>
          <div className="sd-seg">
            <button type="button" className="sd-seg__btn" data-on={!dual} onClick={() => setDual(false)}>{text.monitor.single}</button>
            <button type="button" className="sd-seg__btn" data-on={dual} onClick={() => setDual(true)}>{text.monitor.dual}</button>
          </div>
        </div>
      </div>

      <div className="sd-monitor-stage">
        <div className="sd-monitor-screens">
          {dual && (
            <div className="sd-mon sd-mon--secondary" ref={secondaryBoxRef}>
              <span className="sd-mon__label">{text.monitor.secondary}</span>
              <div
                className="sd-mon__handle sd-mon__handle--left"
                data-active={activeEdge === "left"}
                data-enabled={sideDocks.left.enabled}
                style={{ top: `${Math.round(sideDocks.left.along * 100)}%` }}
                onPointerDown={startDragHandle("left", secondaryBoxRef.current)}
              />
              <div className="sd-mon__seam" aria-hidden="true" />
              <span className="sd-mon__seam-tip">{text.monitor.seamBlocked}</span>
            </div>
          )}

          <div className="sd-mon sd-mon--primary" ref={primaryBoxRef}>
            <span className="sd-mon__label">{text.monitor.primaryHint}</span>
            <div className="sd-mon__island" aria-hidden="true" />
            <div className="sd-mon__center-line" data-snap={snappedCenter} aria-hidden="true" />
            {!dual && (
              <div
                className="sd-mon__handle sd-mon__handle--left"
                data-active={activeEdge === "left"}
                data-enabled={sideDocks.left.enabled}
                style={{ top: `${Math.round(sideDocks.left.along * 100)}%` }}
                onPointerDown={startDragHandle("left", primaryBoxRef.current)}
              />
            )}
            <div
              className="sd-mon__handle sd-mon__handle--right"
              data-active={activeEdge === "right"}
              data-enabled={sideDocks.right.enabled}
              style={{ top: `${Math.round(sideDocks.right.along * 100)}%` }}
              onPointerDown={startDragHandle("right", primaryBoxRef.current)}
            />
            {sideDocks.stages === 3 && (!dual || activeEdge === "right") && (
              <div
                className={`sd-mon__strip sd-mon__strip--${activeEdge}`}
                style={{ top: `${Math.round(sideConfig.along * 100)}%` }}
                aria-hidden="true"
              />
            )}
            {(!dual || activeEdge === "right") && (
              <div
                className={`sd-mon__drawer sd-mon__drawer--${activeEdge}`}
                style={{
                  top: `${topPx}px`,
                  [activeEdge]: `${previewOffset}px`,
                  width: `${scaleW}px`,
                  height: `${scaleH}px`,
                  borderRadius:
                    sideDocks.stages === 2
                      ? activeEdge === "right"
                        ? `${drawerRadius}px 0 0 ${drawerRadius}px`
                        : `0 ${drawerRadius}px ${drawerRadius}px 0`
                      : `${drawerRadius}px`,
                }}
              >
                <span>{sideDocks.drawerWidth}×{sideDocks.drawerHeight}</span>
                <div className="sd-mon__resize-w" onPointerDown={startResizeWidth} />
                <div className="sd-mon__resize-h" onPointerDown={startResizeHeight} />
              </div>
            )}
          </div>
        </div>

        <div className="sd-monitor-foot">
          <span className="sd-monitor-readout">
            {text.monitor.readout(edgeName, Math.round(sideConfig.along * 100), sideDocks.drawerWidth, sideDocks.drawerHeight)}
          </span>
          <div className="sd-seg">
            {SIZE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className="sd-seg__btn"
                data-on={sideDocks.drawerWidth === preset.width && sideDocks.drawerHeight === preset.height}
                onClick={() => saveSideDocks({ ...sideDocks, drawerWidth: preset.width, drawerHeight: preset.height })}
              >
                {text.monitor[preset.key]} {preset.width}×{preset.height}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
