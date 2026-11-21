import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "../../../i18n";
import { startIslandResize } from "../api";
import type { PanelPageSize } from "../../../lib/settings/types";
import { beginResizeDrag, endResizeDrag, getResizeState, setResizeEditing, useResizeState, type ResizeLabel, type ResizeSpec } from "./session.ts";
import type { IslandResizeModel } from "./useIslandResize";
import { useResizeEditing } from "./useResizeEditing";
import { useResizeZones } from "./useResizeZones";
import "./IslandResize.css";

type IslandResizeProps = {
  model: IslandResizeModel;
  expanded: boolean;
  enabled: boolean;
  size: PanelPageSize;
  extra: number;
};

const BADGE_LINGER_MS = 900;
const STUCK_MS = 400;

function spec(kind: ResizeSpec["kind"], widthSign: -1 | 0 | 1, height: boolean, preset = false): ResizeSpec {
  return { kind, widthSign, height, preset };
}

function glowClasses(drag: ResizeSpec | null, armed: string | null, expanded: boolean) {
  const out: string[] = [];
  if (drag) {
    if (drag.kind === "grab") out.push("glow-l", "glow-r");
    else if (drag.widthSign === -1) out.push("glow-l", "half-r");
    else if (drag.widthSign === 1) out.push("glow-r", "half-l");
    if (drag.height && expanded) out.push("glow-b");
  } else if (armed === "l") out.push("glow-l", "half-r");
  else if (armed === "r") out.push("glow-r", "half-l");
  else if (armed === "b") out.push("glow-b");
  return out;
}

function px(value: number) {
  return `calc(${value}px * var(--island-scale, 1))`;
}

export function IslandResize({ model, expanded, enabled, size, extra }: IslandResizeProps) {
  const t = useTranslation();
  const text = t.island.resize;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const { drag, label, flash } = useResizeState();
  const { armed, near } = useResizeZones(rootRef, expanded, enabled && !drag);
  const editing = useResizeEditing(rootRef, chipsRef, model, expanded, enabled);
  const [linger, setLinger] = useState(false);
  const wasDragging = useRef(false);

  useEffect(() => {
    if (drag) {
      wasDragging.current = true;
      return;
    }
    if (!wasDragging.current) return;
    wasDragging.current = false;
    setLinger(true);
    const timer = window.setTimeout(() => setLinger(false), BADGE_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [drag]);

  if (!enabled) return null;

  const start = (next: ResizeSpec) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    beginResizeDrag(next);
    void startIslandResize(next.widthSign, next.height).catch((error: unknown) => {
      console.error("Failed to start resizing the island", error);
      endResizeDrag();
    });
    const release = () => {
      window.setTimeout(() => {
        if (getResizeState().drag === next && !document.documentElement.classList.contains("island-resizing")) endResizeDrag();
      }, STUCK_MS);
    };
    window.addEventListener("pointerup", release, { once: true });
  };
  const resetPanel = () => model.applyPreset("default");
  const resetBar = () => model.applyCollapsed(0);

  const labelText = (value: ResizeLabel) => {
    if (value.preset) return text.preset[value.preset];
    return [value.width, value.height].filter((id) => id !== undefined).map((id) => text.detent[id]).join(" · ");
  };
  const sizeText = expanded ? `${size.width} × ${size.height}` : text.collapsedWidth(`${extra > 0 ? "+" : ""}${extra}`);
  const detentText = labelText(label);
  const showBadge = drag !== null || editing || linger;
  const widthAxis = drag !== null && drag.widthSign !== 0;
  const ticks = drag && !drag.preset && widthAxis ? (expanded ? model.widths : model.collapsedSteps) : [];
  const heightTicks = drag && !drag.preset && drag.height && expanded ? model.heights : [];
  const ghosts = drag?.preset && expanded ? model.presets : [];
  const barGhosts = drag?.preset && !expanded ? model.collapsedSteps : [];
  const tickLeft = (value: number, side: -1 | 1) => (expanded
    ? `calc(50% + ${side} * ${px(value)} / 2)`
    : `calc(50% + ${side} * (100% + ${px(value - extra)}) / 2)`);

  const classes = ["island-resize", expanded ? "island-resize--panel" : "island-resize--bar", editing ? "is-editing" : "", drag ? "is-dragging" : "", ...glowClasses(drag, armed, expanded), ...near.map((name) => `is-near-${name}`)];

  return (
    <div ref={rootRef} className={classes.filter(Boolean).join(" ")} aria-hidden={editing ? undefined : true}>
      {expanded && (
        <>
          <span className="island-resize__glow island-resize__glow--l" />
          <span className="island-resize__glow island-resize__glow--r" />
          <span className="island-resize__glow island-resize__glow--b" />
        </>
      )}
      {!editing && expanded && (
        <>
          <span className={`island-resize__edge island-resize__edge--l${armed === "l" ? " is-armed" : ""}`} onPointerDown={start(spec("edge", -1, false))} />
          <span className={`island-resize__edge island-resize__edge--r${armed === "r" ? " is-armed" : ""}`} onPointerDown={start(spec("edge", 1, false))} />
          <span className={`island-resize__edge island-resize__edge--b${armed === "b" ? " is-armed" : ""}`} onPointerDown={start(spec("edge", 0, true))} />
          <span className={`island-resize__grab${drag?.kind === "grab" ? " is-active" : ""}`} onPointerDown={start(spec("grab", 1, true))} onDoubleClick={resetPanel} />
          <span className={`island-resize__knob island-resize__knob--l${drag?.kind === "knob" && drag.widthSign === -1 ? " is-active" : ""}`} onPointerDown={start(spec("knob", -1, true, true))} onDoubleClick={resetPanel} />
          <span className={`island-resize__knob island-resize__knob--r${drag?.kind === "knob" && drag.widthSign === 1 ? " is-active" : ""}`} onPointerDown={start(spec("knob", 1, true, true))} onDoubleClick={resetPanel} />
        </>
      )}
      {!editing && !expanded && (
        <>
          <span className={`island-resize__edge island-resize__edge--l${armed === "l" ? " is-armed" : ""}`} onPointerDown={start(spec("edge", -1, false, true))} />
          <span className={`island-resize__edge island-resize__edge--r${armed === "r" ? " is-armed" : ""}`} onPointerDown={start(spec("edge", 1, false, true))} />
          <span className={`island-resize__cap island-resize__cap--l${drag?.kind === "cap" && drag.widthSign === -1 ? " is-active" : ""}`} onPointerDown={start(spec("cap", -1, false, true))} onDoubleClick={resetBar} />
          <span className={`island-resize__cap island-resize__cap--r${drag?.kind === "cap" && drag.widthSign === 1 ? " is-active" : ""}`} onPointerDown={start(spec("cap", 1, false, true))} onDoubleClick={resetBar} />
        </>
      )}
      {editing && (
        <>
          <span className="island-resize__outline" />
          <span className="island-resize__bead island-resize__bead--l" onPointerDown={start(spec("bead", -1, false, !expanded))} />
          <span className="island-resize__bead island-resize__bead--r" onPointerDown={start(spec("bead", 1, false, !expanded))} />
          {expanded && (
            <>
              <span className="island-resize__bead island-resize__bead--b" onPointerDown={start(spec("bead", 0, true))} />
              <span className="island-resize__bead island-resize__bead--bl" onPointerDown={start(spec("bead", -1, true, true))} />
              <span className="island-resize__bead island-resize__bead--br" onPointerDown={start(spec("bead", 1, true, true))} />
            </>
          )}
          <div ref={chipsRef} className="island-resize__chips">
            {expanded
              ? model.presets.map((preset) => (
                <button key={preset.id} type="button" className={label.preset === preset.id || (preset.width === size.width && preset.height === size.height) ? "is-on" : ""} onClick={() => model.applyPreset(preset.id)}>{text.preset[preset.id]}</button>
              ))
              : model.collapsedSteps.map((step) => (
                <button key={step.id} type="button" className={step.value === extra ? "is-on" : ""} onClick={() => model.applyCollapsed(step.value)}>{text.detent[step.id]}</button>
              ))}
            <span className="island-resize__keys">{text.keys}</span>
            <button type="button" className="island-resize__done" onClick={() => setResizeEditing(false)}>{text.done}</button>
          </div>
        </>
      )}
      <div className={`island-resize__fx${drag ? " is-shown" : ""}`}>
        {ticks.flatMap((detent) => ([-1, 1] as const).map((side) => (
          <span key={`${detent.id}${side}`} className={`island-resize__tick${label.width === detent.id ? " is-on" : ""}`} style={{ left: tickLeft(detent.value, side) }} />
        )))}
        {heightTicks.map((detent) => (
          <span key={detent.id} className={`island-resize__tick island-resize__tick--y${label.height === detent.id ? " is-on" : ""}`} style={{ "--tick-y": px(detent.value) } as CSSProperties} />
        ))}
        {ghosts.map((preset) => (
          <span key={preset.id} className={`island-resize__ghost${label.preset === preset.id ? " is-on" : ""}`} style={{ width: px(preset.width), height: px(preset.height) }} />
        ))}
        {barGhosts.map((step) => (
          <span key={step.id} className={`island-resize__ghost island-resize__ghost--bar${label.width === step.id ? " is-on" : ""}`} style={{ width: `calc(100% + ${px(step.value - extra)})` }} />
        ))}
      </div>
      <span className={`island-resize__badge${showBadge ? " is-shown" : ""}`}>
        <span key={flash} className="island-resize__flash" />
        <span className="island-resize__size">{sizeText}</span>
        {detentText && <span className="island-resize__detent">{detentText}</span>}
      </span>
    </div>
  );
}
