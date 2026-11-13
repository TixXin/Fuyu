import { useLayoutEffect, useRef, useState } from "react";
import { Check, Download, Pause, Play, SquareBottomDashedScissors, X } from "lucide-react";
import { reportLongBar } from "../../features/screenshot/api";
import { longBarPlace, type PixelRect, type Size } from "../../features/screenshot/selection";
import { useTranslation } from "../../i18n";
import type { LongShot } from "./useLongShot";
import "./LongShotBar.css";

const LIMIT = 20_000;

export function LongShotBar({ area, view, long }: { area: PixelRect; view: Size; long: LongShot }) {
  const t = useTranslation().screenshot.long;
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setSize({ width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const place = longBarPlace(area, view, size);
  useLayoutEffect(() => {
    if (size.width === 0) return;
    reportLongBar({ x: place.x, y: place.y, width: size.width, height: size.height }).catch(() => undefined);
  }, [place.x, place.y, size.width, size.height]);

  const state = long.progress?.state ?? "ready";
  const height = long.progress?.height ?? 0;
  const filled = Math.min(1, height / LIMIT);
  const toggle = state === "ready" ? t.start : long.paused ? t.resume : t.pause;

  return (
    <div
      ref={box}
      className={`long-shot-bar long-shot-bar--${state}`}
      style={{ left: place.x, top: place.y }}
      role="toolbar"
      aria-label={t.title}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="long-shot-bar__head">
        <SquareBottomDashedScissors size={15} aria-hidden="true" />
        <strong>{t.title}</strong>
        <span className="long-shot-bar__height">{t.height(height)}</span>
      </div>
      <div className="long-shot-bar__film" aria-hidden="true">
        {long.preview ? <img src={long.preview} alt="" draggable={false} /> : <span className="long-shot-bar__film-empty" />}
        <span className="long-shot-bar__frames">{t.frames(long.progress?.frames ?? 1)}</span>
      </div>
      <div className="long-shot-bar__meter" aria-hidden="true">
        <span style={{ transform: `scaleX(${filled})` }} />
      </div>
      <p className="long-shot-bar__state" role="status">{t.states[state]}</p>
      <div className="long-shot-bar__actions">
        <button type="button" className="long-shot-bar__button" aria-label={toggle} title={toggle} onClick={long.togglePause}>
          {long.paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
        <button type="button" className="long-shot-bar__button" aria-label={t.cancel} title={t.cancel} onClick={() => long.end("cancel")}>
          <X size={16} aria-hidden="true" />
        </button>
        <button type="button" className="long-shot-bar__button" aria-label={t.save} title={t.save} onClick={() => long.end("save")}>
          <Download size={16} aria-hidden="true" />
        </button>
        <button type="button" className="long-shot-bar__button long-shot-bar__button--primary" aria-label={t.done} title={t.done} onClick={() => long.end("copy")}>
          <Check size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="long-shot-bar__keys">{t.keys}</p>
    </div>
  );
}
