import { useCallback, useEffect, useRef, useState } from "react";
import { installEditorExtension, listenEditorExtensionMissing, type EditorExtensionMissing } from "./api";

const DISMISSED_KEY = "fuyu-agent-editor-extension-dismissed";
const MAX_DISMISSED = 20;
const HINT_MS = 9000;
const DONE_MS = 5000;

export type EditorExtensionHintStatus = "offer" | "installing" | "done" | "failed";

export type EditorExtensionHint = {
  editor: EditorExtensionMissing;
  status: EditorExtensionHintStatus;
  error?: unknown;
};

export function readDismissedEditors(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((app): app is string => typeof app === "string") : [];
  } catch {
    return [];
  }
}

function dismissEditor(app: string) {
  const next = [...readDismissedEditors().filter((other) => other !== app), app].slice(-MAX_DISMISSED);
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
  }
}

export function useEditorExtensionHint() {
  const [hint, setHint] = useState<EditorExtensionHint | null>(null);
  const offered = useRef(new Set<string>());

  useEffect(() => {
    let disposed = false;
    const unlisten = listenEditorExtensionMissing((payload) => {
      if (disposed || offered.current.has(payload.app) || readDismissedEditors().includes(payload.app)) return;
      offered.current.add(payload.app);
      setHint({ editor: payload, status: "offer" });
    }).catch(() => undefined);
    return () => {
      disposed = true;
      void unlisten.then((stop) => stop?.());
    };
  }, []);

  const status = hint?.status;
  useEffect(() => {
    if (status !== "offer" && status !== "done") return;
    const timer = window.setTimeout(() => setHint(null), status === "done" ? DONE_MS : HINT_MS);
    return () => window.clearTimeout(timer);
  }, [hint, status]);

  const install = useCallback(() => {
    if (!hint || hint.status === "installing") return;
    const editor = hint.editor;
    setHint({ editor, status: "installing" });
    installEditorExtension(editor.app)
      .then(() => setHint({ editor, status: "done" }))
      .catch((error: unknown) => setHint({ editor, status: "failed", error }));
  }, [hint]);

  const dismiss = useCallback(() => {
    if (hint) dismissEditor(hint.editor.app);
    setHint(null);
  }, [hint]);

  const close = useCallback(() => setHint(null), []);

  return { hint, install, dismiss, close };
}
