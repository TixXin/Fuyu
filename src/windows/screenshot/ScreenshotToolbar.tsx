import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownToLine, Check, Circle, Download, EyeOff, Grid3x3, Hash, Highlighter, MoveUpRight, Pencil, Pin, Redo2, ScanText, Square, Type, Undo2, X, type LucideIcon } from "lucide-react";
import type { ScreenshotAction } from "../../features/screenshot/api";
import { ANNOTATION_COLORS, ANNOTATION_TOOLS, STROKE_LEVELS, type AnnotationTool } from "../../features/screenshot/annotations";
import type { PixelRect, Size } from "../../features/screenshot/selection";
import { useTranslation } from "../../i18n";
import type { Annotations } from "./useAnnotations";
import "./ScreenshotToolbar.css";

const TOOL_ICONS: Record<AnnotationTool, LucideIcon> = {
  rect: Square,
  ellipse: Circle,
  arrow: MoveUpRight,
  pen: Pencil,
  highlighter: Highlighter,
  text: Type,
  mosaic: Grid3x3,
  number: Hash,
};

const ONE_ROW = 48;
const TWO_ROWS = 88;
const EDGE = 4;

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`screenshot-overlay__button${active ? " screenshot-overlay__button--active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ScreenshotToolbar({
  area,
  view,
  annotations,
  notice,
  onCancel,
  onFinish,
  onRedact,
}: {
  area: PixelRect;
  view: Size;
  annotations: Annotations;
  notice: string | null;
  onCancel: () => void;
  onFinish: (action: ScreenshotAction) => void;
  onRedact: () => void;
}) {
  const t = useTranslation().screenshot;
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    setWidth(element.offsetWidth);
    const observer = new ResizeObserver(() => setWidth(element.offsetWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const left = Math.min(Math.max(EDGE, area.x + area.width - width), Math.max(EDGE, view.width - width - EDGE));
  const space = annotations.tool ? TWO_ROWS : ONE_ROW;
  const place = area.y + area.height + space <= view.height ? { top: area.y + area.height + 8 }
    : area.y >= space ? { bottom: view.height - area.y + 8 }
    : { bottom: view.height - area.y - area.height + 8 };

  return (
    <div
      ref={box}
      className="screenshot-overlay__toolbar"
      style={{ left, ...place }}
      role="toolbar"
      aria-label={t.toolbar}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="screenshot-overlay__toolbar-row">
        {ANNOTATION_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool];
          return (
            <ToolButton key={tool} label={t.tools[tool]} active={annotations.tool === tool} onClick={() => annotations.chooseTool(tool)}>
              <Icon size={18} />
            </ToolButton>
          );
        })}
        <span className="screenshot-overlay__separator" />
        <ToolButton label={t.undo} disabled={!annotations.canUndo} onClick={annotations.undo}>
          <Undo2 size={18} />
        </ToolButton>
        <ToolButton label={t.redo} disabled={!annotations.canRedo} onClick={annotations.redo}>
          <Redo2 size={18} />
        </ToolButton>
        <span className="screenshot-overlay__separator" />
        <ToolButton label={t.longShot} onClick={() => onFinish("long")}>
          <ArrowDownToLine size={18} />
        </ToolButton>
        <ToolButton label={t.redact} onClick={onRedact}>
          <EyeOff size={18} />
        </ToolButton>
        <ToolButton label={t.readText} onClick={() => onFinish("text")}>
          <ScanText size={18} />
        </ToolButton>
        <ToolButton label={t.pin} onClick={() => onFinish("pin")}>
          <Pin size={18} />
        </ToolButton>
        <ToolButton label={t.save} onClick={() => onFinish("save")}>
          <Download size={18} />
        </ToolButton>
        <ToolButton label={t.cancel} onClick={onCancel}>
          <X size={18} />
        </ToolButton>
        <button type="button" className="screenshot-overlay__button screenshot-overlay__button--primary" aria-label={t.copy} title={t.copy} onClick={() => onFinish("copy")}>
          <Check size={18} />
        </button>
      </div>
      {annotations.tool && (
        <div className="screenshot-overlay__toolbar-row">
          {STROKE_LEVELS.map((level) => (
            <ToolButton key={level} label={t.sizes[level]} active={annotations.style.level === level} onClick={() => annotations.setLevel(level)}>
              <span className="screenshot-overlay__size-dot" style={{ width: 4 + level * 4, height: 4 + level * 4 }} />
            </ToolButton>
          ))}
          <span className="screenshot-overlay__separator" />
          {ANNOTATION_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`screenshot-overlay__swatch${annotations.style.color === color ? " screenshot-overlay__swatch--active" : ""}`}
              style={{ background: color }}
              aria-label={t.color(color)}
              aria-pressed={annotations.style.color === color}
              title={color}
              onClick={() => annotations.setColor(color)}
            />
          ))}
        </div>
      )}
      {notice && <div className="screenshot-overlay__notice">{notice}</div>}
    </div>
  );
}
