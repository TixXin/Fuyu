import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_HISTORY,
  addAnnotation,
  extendAnnotation,
  isMeaningful,
  redoAnnotation,
  startAnnotation,
  textSize,
  undoAnnotation,
  type Annotation,
  type AnnotationHistory,
  type AnnotationStyle,
  type AnnotationTool,
} from "../../features/screenshot/annotations";
import { loadAnnotationStyle, saveAnnotationStyle } from "../../features/screenshot/storage";
import type { Point } from "../../features/screenshot/selection";

/**
 * The annotations of the open screenshot (C41.3): the chosen tool, colour and thickness, what is
 * drawn (with undo and redo), the stroke being dragged, and the text box being typed in. A new
 * screenshot starts empty; the colour and thickness carry over (storage.ts). `scale` is picture
 * pixels per CSS pixel, so lines look as thick on every monitor.
 */
export function useAnnotations(sessionId: number | undefined, scale: number) {
  const [tool, setTool] = useState<AnnotationTool | null>(null);
  const [style, setStyle] = useState<AnnotationStyle>(loadAnnotationStyle);
  const [history, setHistory] = useState<AnnotationHistory>(EMPTY_HISTORY);
  const [draft, setDraftState] = useState<Annotation | null>(null);
  const [editing, setEditing] = useState<Point | null>(null);
  // The draft is read in pointer handlers right after it is set, so it also lives in a ref.
  const draftRef = useRef<Annotation | null>(null);
  const setDraft = (next: Annotation | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  /** Drops everything drawn and turns the tool off (a new screenshot, or the selection was cleared). */
  const reset = useCallback(() => {
    draftRef.current = null;
    setDraftState(null);
    setHistory(EMPTY_HISTORY);
    setEditing(null);
    setTool(null);
  }, []);

  useEffect(reset, [sessionId, reset]);

  useEffect(() => saveAnnotationStyle(style), [style]);

  /** A press inside the selection with a tool on. */
  const begin = (point: Point) => {
    if (!tool) return;
    if (tool === "text") {
      // A press while a box is open only closes it (its blur keeps the text).
      if (!editing) setEditing(point);
      return;
    }
    const started = startAnnotation(tool, point, style, scale, history.items);
    if (started?.kind === "number") setHistory((current) => addAnnotation(current, started));
    else setDraft(started);
  };

  const extend = (point: Point) => {
    if (draftRef.current) setDraft(extendAnnotation(draftRef.current, point));
  };

  /** Ends the drag; false when no annotation was being drawn. */
  const finish = () => {
    const done = draftRef.current;
    if (!done) return false;
    if (isMeaningful(done)) setHistory((current) => addAnnotation(current, done));
    setDraft(null);
    return true;
  };

  /** The text box closed: what was typed becomes an annotation where it was opened. */
  const commitText = (text: string) => {
    const at = editing;
    setEditing(null);
    if (!at || !text.trim()) return;
    setHistory((current) => addAnnotation(current, { kind: "text", color: style.color, size: textSize(style.level, scale), at, text: text.replace(/\s+$/, "") }));
  };

  return {
    tool,
    /** Choosing the tool that is on turns it off (back to moving and resizing the selection). */
    chooseTool: (next: AnnotationTool) => setTool((current) => (current === next ? null : next)),
    clearTool: () => setTool(null),
    style,
    setColor: (color: string) => setStyle((current) => ({ ...current, color })),
    setLevel: (level: AnnotationStyle["level"]) => setStyle((current) => ({ ...current, level })),
    items: history.items,
    draft,
    drafting: draft !== null,
    canUndo: history.items.length > 0,
    canRedo: history.undone.length > 0,
    undo: () => setHistory(undoAnnotation),
    redo: () => setHistory(redoAnnotation),
    editing,
    begin,
    extend,
    finish,
    commitText,
    cancelText: () => setEditing(null),
    reset,
  };
}

export type Annotations = ReturnType<typeof useAnnotations>;
