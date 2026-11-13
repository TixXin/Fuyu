import { rulerBetween, type Edges } from "../../features/screenshot/measure";
import type { Point } from "../../features/screenshot/selection";
import { useTranslation } from "../../i18n";
import "./MeasureLayer.css";

export function MeasureLayer({ edges, from, to, scale }: { edges: Edges | null; from: Point | null; to: Point; scale: number }) {
  const t = useTranslation().screenshot;
  const css = (value: number) => value / scale;
  const centre = (value: number) => (value + 0.5) / scale;

  if (from) {
    const ruler = rulerBetween(from, to);
    const a = { x: centre(from.x), y: centre(from.y) };
    const b = { x: centre(to.x), y: centre(to.y) };
    return (
      <div className="screenshot-measure" aria-hidden="true">
        <svg className="screenshot-measure__ruler">
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          <circle cx={a.x} cy={a.y} r={3} />
          <circle cx={b.x} cy={b.y} r={3} />
        </svg>
        <span className="screenshot-measure__label" style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}>
          {t.ruler(ruler.length, ruler.dx, ruler.dy)}
        </span>
      </div>
    );
  }

  if (!edges) return null;
  const width = edges.right - edges.left;
  const height = edges.bottom - edges.top;
  return (
    <div className="screenshot-measure" aria-hidden="true">
      <div className="screenshot-measure__line screenshot-measure__line--h" style={{ left: css(edges.left), width: css(width), top: centre(to.y) }} />
      <div className="screenshot-measure__line screenshot-measure__line--v" style={{ top: css(edges.top), height: css(height), left: centre(to.x) }} />
      <span className="screenshot-measure__label screenshot-measure__label--edges" style={{ left: centre(to.x), top: centre(to.y) }}>
        {width} × {height}
      </span>
    </div>
  );
}
