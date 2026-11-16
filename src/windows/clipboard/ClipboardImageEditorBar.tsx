import type { ReactNode } from "react";
import { Circle, Crop, Grid3x3, Hash, Highlighter, MoveUpRight, Pencil, Redo2, RotateCcw, RotateCw, Square, Type, Undo2, type LucideIcon } from "lucide-react";
import { ANNOTATION_COLORS, ANNOTATION_TOOLS, STROKE_LEVELS, type AnnotationTool } from "../../features/screenshot/annotations";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { ImageEditor } from "./useImageEditor";

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

function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" tabIndex={-1} className="clipboard-image-editor__tool" aria-label={label} aria-pressed={active} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function ClipboardImageEditorBar({ editor, saving }: { editor: ImageEditor; saving: boolean }) {
  const t = useTranslation();
  const words = t.clipboard.previewWindow.image;
  const shot = t.screenshot;
  const { annotations } = editor;
  const ready = editor.base !== null && !saving;
  return (
    <div className="clipboard-image-editor__bar" role="toolbar" aria-label={words.toolbar}>
      <div className="clipboard-image-editor__row">
        <Tool label={words.crop} active={editor.cropping} disabled={!ready} onClick={editor.startCrop}><Crop size={15} /></Tool>
        <Tool label={words.rotateLeft} disabled={!ready} onClick={() => editor.rotate(-1)}><RotateCcw size={15} /></Tool>
        <Tool label={words.rotateRight} disabled={!ready} onClick={() => editor.rotate(1)}><RotateCw size={15} /></Tool>
        <span className="clipboard-image-editor__divider" />
        {ANNOTATION_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool];
          return <Tool key={tool} label={shot.tools[tool]} active={annotations.tool === tool} disabled={!ready} onClick={() => editor.chooseTool(tool)}><Icon size={15} /></Tool>;
        })}
        <span className="clipboard-image-editor__divider" />
        <Tool label={isMacOS ? shot.undoMac : shot.undo} disabled={!ready || !editor.canUndo} onClick={editor.undo}><Undo2 size={15} /></Tool>
        <Tool label={isMacOS ? shot.redoMac : shot.redo} disabled={!ready || !annotations.canRedo} onClick={editor.redo}><Redo2 size={15} /></Tool>
      </div>
      {editor.cropping && (
        <div className="clipboard-image-editor__row">
          <span className="clipboard-image-editor__hint">{words.cropHint}</span>
          <button type="button" tabIndex={-1} className="clipboard-image-editor__apply" disabled={!editor.crop} onClick={editor.applyCrop}>{words.applyCrop}<kbd>↵</kbd></button>
        </div>
      )}
      {annotations.tool && (
        <div className="clipboard-image-editor__row">
          {STROKE_LEVELS.map((level) => (
            <Tool key={level} label={shot.sizes[level]} active={annotations.style.level === level} onClick={() => annotations.setLevel(level)}>
              <span className="clipboard-image-editor__dot" style={{ width: 4 + level * 4, height: 4 + level * 4 }} />
            </Tool>
          ))}
          <span className="clipboard-image-editor__divider" />
          {ANNOTATION_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              tabIndex={-1}
              className="clipboard-image-editor__swatch"
              style={{ background: color }}
              aria-label={shot.color(color)}
              aria-pressed={annotations.style.color === color}
              title={color}
              onClick={() => annotations.setColor(color)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
