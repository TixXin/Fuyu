import type { ReactNode } from "react";
import { Check, Redo2, Trash2, Undo2, X } from "lucide-react";
import { ANNOTATION_COLORS, ANNOTATION_TOOLS, STROKE_LEVELS, TOOL_KEYS, toolStyles } from "../../features/screenshot/annotations";
import { TOOL_ICONS } from "../../features/screenshot/annotationToolIcons";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { Annotations } from "./useAnnotations";
import type { AnnotationSelect } from "./useAnnotationSelect";

function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`pin-annotate__tool${active ? " pin-annotate__tool--active" : ""}`} aria-label={label} aria-pressed={active} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function PinAnnotateBar({ annotations, select, onDone, onCancel }: { annotations: Annotations; select: AnnotationSelect; onDone: () => void; onCancel: () => void }) {
  const t = useTranslation().screenshot;
  const picked = select.selected;
  const parts = picked ? toolStyles(picked.kind) : annotations.tool ? toolStyles(annotations.tool) : { color: false, level: false };
  const color = picked ? picked.color : annotations.style.color;
  const level = picked ? select.level : annotations.style.level;
  return (
    <div className="pin-annotate" role="toolbar" aria-label={t.toolbar} onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
      <div className="pin-annotate__row">
        {ANNOTATION_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool];
          return (
            <Tool key={tool} label={t.toolWithKey(t.tools[tool], TOOL_KEYS[tool])} active={annotations.tool === tool} onClick={() => {
              select.clear();
              annotations.chooseTool(tool);
            }}>
              <Icon size={15} />
            </Tool>
          );
        })}
      </div>
      <div className="pin-annotate__row">
        {parts.level && STROKE_LEVELS.map((value) => (
          <Tool key={value} label={t.sizes[value]} active={level === value} onClick={() => (picked ? select.restyle({ level: value }) : annotations.setLevel(value))}>
            <span className="pin-annotate__dot" style={{ width: 3 + value * 3, height: 3 + value * 3 }} />
          </Tool>
        ))}
        {parts.color && ANNOTATION_COLORS.map((value) => (
          <button
            key={value}
            type="button"
            className={`pin-annotate__swatch${color === value ? " pin-annotate__swatch--active" : ""}`}
            style={{ background: value }}
            aria-label={t.color(value)}
            aria-pressed={color === value}
            title={value}
            onClick={() => (picked ? select.restyle({ color: value }) : annotations.setColor(value))}
          />
        ))}
        {picked && (
          <Tool label={t.deleteAnnotation} onClick={select.remove}>
            <Trash2 size={15} />
          </Tool>
        )}
        <span className="pin-annotate__spacer" />
        <Tool label={isMacOS ? t.undoMac : t.undo} disabled={!annotations.canUndo} onClick={annotations.undo}>
          <Undo2 size={15} />
        </Tool>
        <Tool label={isMacOS ? t.redoMac : t.redo} disabled={!annotations.canRedo} onClick={annotations.redo}>
          <Redo2 size={15} />
        </Tool>
        <Tool label={t.pinAnnotate.cancel} onClick={onCancel}>
          <X size={15} />
        </Tool>
        <button type="button" className="pin-annotate__tool pin-annotate__tool--primary" aria-label={t.pinAnnotate.done} title={t.pinAnnotate.done} onClick={onDone}>
          <Check size={15} />
        </button>
      </div>
    </div>
  );
}
