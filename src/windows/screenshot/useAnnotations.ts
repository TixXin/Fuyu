import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_HISTORY,
  addAnnotation,
  addAnnotations,
  extendAnnotation,
  removeAnnotation,
  isMeaningful,
  redoAnnotation,
  replaceAnnotation,
  startAnnotation,
  textSize,
  undoAnnotation,
  type Annotation,
  type AnnotationHistory,
  type AnnotationStyle,
  type AnnotationTool,
  type TextAnnotation,
} from "../../features/screenshot/annotations";
import { loadAnnotationStyle, saveAnnotationStyle } from "../../features/screenshot/storage";
import type { Point } from "../../features/screenshot/selection";

export type TextEdit = { at: Point; item?: TextAnnotation };

export function useAnnotations(sessionId: number | undefined, scale: number) {
  const [tool, setTool] = useState<AnnotationTool | null>(null);
  const [style, setStyle] = useState<AnnotationStyle>(loadAnnotationStyle);
  const [history, setHistory] = useState<AnnotationHistory>(EMPTY_HISTORY);
  const [draft, setDraftState] = useState<Annotation | null>(null);
  const [editing, setEditing] = useState<TextEdit | null>(null);
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
      if (!editing) setEditing({ at: point });
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
    const edit = editing;
    setEditing(null);
    if (!edit) return;
    const kept = text.replace(/\s+$/, "");
    const { item } = edit;
    if (item) setHistory((current) => (kept.trim() ? replaceAnnotation(current, item, kept === item.text ? item : { ...item, text: kept }) : removeAnnotation(current, item)));
    else if (kept.trim()) setHistory((current) => addAnnotation(current, { kind: "text", color: style.color, size: textSize(style.level, scale), at: edit.at, text: kept }));
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
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    addMany: (list: readonly Annotation[]) => setHistory((current) => addAnnotations(current, list)),
    remove: (item: Annotation) => setHistory((current) => removeAnnotation(current, item)),
    replace: (item: Annotation, next: Annotation) => setHistory((current) => replaceAnnotation(current, item, next)),
    editText: (item: TextAnnotation) => {
      setTool(null);
      setEditing({ at: item.at, item });
    },
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
