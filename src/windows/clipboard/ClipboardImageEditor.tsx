import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { reportClipboardPreview, saveClipboardHistoryImage, type ClipboardHistoryItem } from "../../features/clipboard/api";
import { imageEditKey, toImagePoint, type ImageSize } from "../../features/clipboard/imageEdit";
import { usePreviewEditSession } from "../../features/clipboard/usePreviewEditSession";
import { textSize } from "../../features/screenshot/annotations";
import { drawAnnotations } from "../../features/screenshot/drawAnnotations";
import { useTranslation } from "../../i18n";
import { PRIMARY_KEY } from "../../lib/shortcut/shortcut";
import { AnnotationTextInput } from "../screenshot/AnnotationTextInput";
import { ClipboardImageEditorBar } from "./ClipboardImageEditorBar";
import { useImageEditor } from "./useImageEditor";
import "../../features/clipboard/ClipboardPopupPanels.css";
import "./ClipboardImageEditor.css";

function useBoxSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ImageSize>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

export function ClipboardImageEditor({ item, onDone }: { item: ClipboardHistoryItem; onDone: () => void }) {
  const t = useTranslation();
  const words = t.clipboard.previewWindow.image;
  const actions = t.clipboard.popup.actions;
  const finish = usePreviewEditSession(item.id, onDone);
  const frame = useBoxSize();
  const editor = useImageEditor(item.id, frame.size);
  const { base, annotations, crop } = editor;
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLCanvasElement>(null);
  const stageRectRef = useRef<DOMRect | null>(null);
  const activePointerRef = useRef(false);
  const moveFrameRef = useRef(0);
  const pendingClientRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (base) picture.current?.replaceChildren(base);
  }, [base]);

  useEffect(() => {
    stageRectRef.current = null;
  }, [base, frame.size.width, frame.size.height]);

  useEffect(() => () => {
    if (moveFrameRef.current !== 0) window.cancelAnimationFrame(moveFrameRef.current);
  }, []);

  useEffect(() => {
    const canvas = layer.current;
    const context = canvas?.getContext("2d");
    if (!base || !canvas || !context) return;
    if (canvas.width !== base.width || canvas.height !== base.height) {
      canvas.width = base.width;
      canvas.height = base.height;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawAnnotations(context, annotations.draft ? [...annotations.items, annotations.draft] : annotations.items, base, null);
  }, [base, annotations.items, annotations.draft]);

  const save = async (mode: "replace" | "new") => {
    if (saving || !base) return;
    if (!editor.changed) return void finish("refocus");
    const pixels = editor.compose();
    if (!pixels) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveClipboardHistoryImage(item.id, pixels, mode);
      if (mode === "replace") void reportClipboardPreview({ type: "edited", id: item.id }).catch((error: unknown) => console.error("Failed to report the edit", error));
      void finish("refocus");
    } catch (error) {
      console.error("Failed to save the edited image", error);
      setFailed(true);
      setSaving(false);
    }
  };
  const latest = useRef({ save, editor, finish });
  latest.current = { save, editor, finish };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.target instanceof HTMLTextAreaElement) return;
      const { save, editor, finish } = latest.current;
      const key = imageEditKey(event);
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      if (key === "save") void save("replace");
      else if (key === "save-as-new") void save("new");
      else if (key === "undo") editor.undo();
      else if (key === "redo") editor.redo();
      else if (key === "apply") editor.applyCrop();
      else if (editor.cropping) editor.cancelCrop();
      else void finish("refocus");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const pointAt = (client: { x: number; y: number }, rect: DOMRect | null) =>
    rect && base ? toImagePoint(client, rect, base) : { x: 0, y: 0 };

  const latestMoveRef = useRef<(client: { x: number; y: number }) => void>(() => {});
  latestMoveRef.current = (client: { x: number; y: number }) => {
    const rect = stageRectRef.current ?? stage.current?.getBoundingClientRect() ?? null;
    stageRectRef.current = rect;
    editor.pointerMove(pointAt(client, rect));
  };

  const flushMove = () => {
    if (moveFrameRef.current !== 0) {
      window.cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = 0;
    }
    const next = pendingClientRef.current;
    if (next) {
      pendingClientRef.current = null;
      latestMoveRef.current(next);
    }
  };

  const finishPointer = () => {
    if (!activePointerRef.current) return;
    flushMove();
    activePointerRef.current = false;
    stageRectRef.current = null;
    editor.pointerUp();
  };

  const style = base ? ({ width: base.width, height: base.height, "--image-fit": editor.fit } as CSSProperties) : undefined;
  const cursor = editor.cropping || (annotations.tool && annotations.tool !== "text") ? " clipboard-image-editor__stage--draw" : annotations.tool === "text" ? " clipboard-image-editor__stage--text" : "";

  return (
    <div className={`clipboard-image-editor${saving ? " clipboard-image-editor--saving" : ""}`}>
      <ClipboardImageEditorBar editor={editor} saving={saving} />
      <div ref={frame.ref} className="clipboard-image-editor__frame">
        {editor.failed && <p className="clipboard-image-editor__message">{words.unreadable}</p>}
        {base && (
          <div
            ref={stage}
            className={`clipboard-image-editor__stage${cursor}`}
            style={style}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              flushMove();
              const rect = stage.current?.getBoundingClientRect() ?? null;
              stageRectRef.current = rect;
              if (!editor.pointerDown(pointAt({ x: event.clientX, y: event.clientY }, rect))) {
                stageRectRef.current = null;
                return;
              }
              activePointerRef.current = true;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                return;
              }
            }}
            onPointerMove={(event) => {
              if (!activePointerRef.current) return;
              pendingClientRef.current = { x: event.clientX, y: event.clientY };
              if (moveFrameRef.current === 0) {
                moveFrameRef.current = window.requestAnimationFrame(() => {
                  moveFrameRef.current = 0;
                  const next = pendingClientRef.current;
                  if (next) {
                    pendingClientRef.current = null;
                    latestMoveRef.current(next);
                  }
                });
              }
            }}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
          >
            <div ref={picture} className="clipboard-image-editor__picture" />
            <canvas ref={layer} className="clipboard-image-editor__layer" />
            {crop && <div className="clipboard-image-editor__crop" style={{ left: crop.x, top: crop.y, width: crop.width, height: crop.height }} />}
            {annotations.editing && (
              <AnnotationTextInput
                at={annotations.editing}
                color={annotations.style.color}
                size={textSize(annotations.style.level, 1 / editor.fit)}
                placeholder={t.screenshot.textPlaceholder}
                onCommit={annotations.commitText}
                onCancel={annotations.cancelText}
              />
            )}
          </div>
        )}
      </div>
      {(saving || failed) && <p className="clipboard-image-editor__status" role="status">{saving ? words.saving : words.failed}</p>}
      <div className="clipboard-editor__buttons">
        <button type="button" tabIndex={-1} className="clipboard-editor__primary" disabled={!base || saving} onClick={() => void save("replace")}>{actions.saveInPlace}<kbd>{PRIMARY_KEY} S</kbd></button>
        <button type="button" tabIndex={-1} disabled={!base || saving} onClick={() => void save("new")}>{actions.saveAsNew}<kbd>{PRIMARY_KEY} ⇧ S</kbd></button>
        <button type="button" tabIndex={-1} onClick={() => void finish("refocus")}>{actions.cancel}<kbd>Esc</kbd></button>
      </div>
    </div>
  );
}
