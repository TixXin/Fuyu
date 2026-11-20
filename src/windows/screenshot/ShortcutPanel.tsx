import { Fragment, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from "react";
import { ChevronDown, GripVertical, Keyboard } from "lucide-react";
import { cornerPosition, nearestCorner, overlaps, shortcutSheet, type CssBox, type SheetPhase } from "../../features/screenshot/shortcutSheet";
import type { Size } from "../../features/screenshot/selection";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { useShortcutPanel } from "./useShortcutPanel";
import "./ShortcutPanel.css";

type Props = {
  sessionId: number | undefined;
  phase: SheetPhase;
  pointer: { x: number; y: number } | null;
  startsHere: boolean;
  area: CssBox | null;
  typing: boolean;
  view: Size;
};

const MAGNIFIER = { offset: 16, width: 170, height: 190 };
const TOOLBAR_HEIGHT = 100;

function avoidBoxes(pointer: Props["pointer"], area: CssBox | null): CssBox[] {
  const boxes: CssBox[] = [];
  if (pointer) {
    boxes.push({ x: pointer.x - 4, y: pointer.y - 4, width: 8, height: 8 });
    boxes.push({ x: pointer.x + MAGNIFIER.offset, y: pointer.y + MAGNIFIER.offset, width: MAGNIFIER.width, height: MAGNIFIER.height });
  }
  if (area) boxes.push(area, { x: area.x, y: area.y + area.height, width: area.width, height: TOOLBAR_HEIGHT });
  return boxes;
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

export function ShortcutPanel({ sessionId, phase, pointer, startsHere, area, typing, view }: Props) {
  const t = useTranslation().screenshot.sheet;
  const panel = useShortcutPanel(sessionId, typing);
  const ref = useRef<HTMLElement | null>(null);
  const setRef = (element: HTMLElement | null) => {
    ref.current = element;
  };
  const wasInside = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState<{ dx: number; dy: number; x: number; y: number } | null>(null);
  const [overHead, setOverHead] = useState(false);
  const [leftHere, setLeftHere] = useState(false);
  const inside = pointer !== null;

  useEffect(() => {
    wasInside.current = false;
    setLeftHere(false);
  }, [sessionId]);
  useEffect(() => {
    if (inside) wasInside.current = true;
    else if (wasInside.current) setLeftHere(true);
  }, [inside]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setSize((current) => (current.width === element.offsetWidth && current.height === element.offsetHeight ? current : { width: element.offsetWidth, height: element.offsetHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [panel.state]);

  if (panel.state === "off" || !(inside || (startsHere && !leftHere))) return null;

  const at = drag ?? cornerPosition(panel.corner, view, size);
  const box = { x: at.x, y: at.y, width: size.width, height: size.height };
  const faded = !drag && !overHead && size.width > 0 && avoidBoxes(pointer, area).some((other) => overlaps(box, other));
  const style = { left: at.x, top: at.y };

  if (panel.state === "collapsed") {
    return (
      <button
        ref={setRef}
        type="button"
        className={`screenshot-sheet-pill${faded ? " screenshot-sheet--faded" : ""}`}
        style={style}
        aria-label={t.expand}
        title={t.expand}
        onPointerDown={stop}
        onPointerUp={stop}
        onDoubleClick={stop}
        onContextMenu={stop}
        onClick={panel.toggle}
      >
        <Keyboard size={13} aria-hidden="true" />
        <kbd>?</kbd>
      </button>
    );
  }

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ dx: event.clientX - at.x, dy: event.clientY - at.y, x: at.x, y: at.y });
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    event.stopPropagation();
    const x = Math.max(0, Math.min(view.width - size.width, event.clientX - drag.dx));
    const y = Math.max(0, Math.min(view.height - size.height, event.clientY - drag.dy));
    setDrag({ ...drag, x, y });
  };
  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!drag) return;
    panel.moveTo(nearestCorner({ ...box, x: drag.x, y: drag.y }, view));
    setDrag(null);
  };

  return (
    <div
      ref={setRef}
      className={`screenshot-sheet${faded ? " screenshot-sheet--faded" : ""}${drag ? " screenshot-sheet--dragging" : ""}`}
      style={style}
      onDoubleClick={stop}
      onContextMenu={stop}
    >
      <div
        className="screenshot-sheet__head"
        title={t.dragHint}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerEnter={() => setOverHead(true)}
        onPointerLeave={() => setOverHead(false)}
      >
        <GripVertical size={13} className="screenshot-sheet__grip" aria-hidden="true" />
        <span className="screenshot-sheet__title">{t.title}</span>
        <button type="button" className="screenshot-sheet__collapse" aria-label={t.collapse} title={t.collapse} onPointerDown={stop} onClick={panel.toggle}>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
      <div className={`screenshot-sheet__grid${phase === "edit" ? " screenshot-sheet__grid--two" : ""}`}>
        {shortcutSheet(phase, isMacOS).map((group) => (
          <Fragment key={group.section}>
            <div className="screenshot-sheet__section">{t.sections[group.section]}</div>
            {group.rows.map((row) => (
              <div key={row.id} className="screenshot-sheet__row">
                <span>{t.rows[row.id]}</span>
                <span className="screenshot-sheet__keys">
                  {row.word && <span className="screenshot-sheet__word">{t.words[row.word]}</span>}
                  {row.keys.map((key, index) => (
                    <Fragment key={key}>
                      {row.either && index > 0 && <span className="screenshot-sheet__or">/</span>}
                      <kbd>{key}</kbd>
                    </Fragment>
                  ))}
                </span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
