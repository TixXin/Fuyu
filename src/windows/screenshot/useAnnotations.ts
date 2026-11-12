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

export function useAnnotations(sessionId: number | undefined, scale: number) {
  const [tool, setTool] = useState<AnnotationTool | null>(null);
  const [style, setStyle] = useState<AnnotationStyle>(loadAnnotationStyle);
  const [history, setHistory] = useState<AnnotationHistory>(EMPTY_HISTORY);
  const [draft, setDraftState] = useState<Annotation | null>(null);
  const [editing, setEditing] = useState<Point | null>(null);
  const draftRef = useRef<Annotation | null>(null);
  const setDraft = (next: Annotation | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const reset = useCallback(() => {
    draftRef.current = null;
    setDraftState(null);
    setHistory(EMPTY_HISTORY);
    setEditing(null);
    setTool(null);
  }, []);

  useEffect(reset, [sessionId, reset]);

  useEffect(() => saveAnnotationStyle(style), [style]);

  const begin = (point: Point) => {
    if (!tool) return;
    if (tool === "text") {
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

  const finish = () => {
    const done = draftRef.current;
    if (!done) return false;
    if (isMeaningful(done)) setHistory((current) => addAnnotation(current, done));
    setDraft(null);
    return true;
  };

  const commitText = (text: string) => {
    const at = editing;
    setEditing(null);
    if (!at || !text.trim()) return;
    setHistory((current) => addAnnotation(current, { kind: "text", color: style.color, size: textSize(style.level, scale), at, text: text.replace(/\s+$/, "") }));
  };

  return {
    tool,
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
