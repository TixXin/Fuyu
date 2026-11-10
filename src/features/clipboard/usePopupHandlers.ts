import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import {
  addClipboardHistoryText, deleteClipboardItem, ignoreNextClipboardCopy, pasteClipboardText, pauseClipboardCapture, readClipboardImageQr,
  resumeClipboardCapture, saveClipboardSnippet, setClipboardItemNote, type ClipboardCopyAs, type ClipboardHistoryItem,
} from "./api";
import type { PopupActionHandlers } from "./popupActions";
import { usePendingDelete } from "./usePendingDelete";

const NOTICE_MS = 2_500;

/**
 * What the clipboard window's actions do (C38). Pasting an entry goes through `onPaste` from the
 * window; the rest calls the native side here. Failures and results that need saying show for a
 * moment in the footer (`notice`).
 */
export function usePopupHandlers({ onPaste, onToggleFavorite, onEdit }: {
  onPaste: (id: string, plain: boolean, options?: { enter?: boolean; copyAs?: ClipboardCopyAs }) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: () => void;
}) {
  const text = useTranslation().clipboard.popup.actions;
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const say = useCallback((message: string) => {
    window.clearTimeout(timer.current);
    setNotice(message);
    timer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const attempt = useCallback((action: string, promise: Promise<unknown>) => {
    void promise.catch((error: unknown) => {
      console.error(`Failed to ${action}`, error);
      say(text.failed);
    });
  }, [say, text.failed]);

  const deletion = usePendingDelete((id) => attempt("delete a clipboard entry", deleteClipboardItem(id)));
  const editRef = useRef(onEdit);
  editRef.current = onEdit;

  const pasteText = useCallback((value: string, enter = false) => attempt("paste text", pasteClipboardText(value, enter)), [attempt]);

  const handlers = useMemo<PopupActionHandlers>(() => ({
    paste: (id, options = {}) => onPaste(id, options.plain ?? false, { enter: options.enter, copyAs: options.copyAs }),
    pasteText,
    pasteQr: (id) =>
      attempt("read a QR code", readClipboardImageQr(id).then((content) => (content ? pasteClipboardText(content) : say(text.noQr)))),
    edit: () => editRef.current(),
    toggleFavorite: onToggleFavorite,
    saveSnippet: (item: ClipboardHistoryItem) => {
      const value = item.text ?? item.preview;
      const title = [...value.replace(/\s+/g, " ").trim()].slice(0, 20).join("");
      attempt("save a snippet", saveClipboardSnippet(null, title, value).then(() => say(text.snippetSaved)));
    },
    remove: deletion.remove,
    pause: (minutes) => attempt("pause the history", pauseClipboardCapture(minutes)),
    resume: () => attempt("resume the history", resumeClipboardCapture()),
    ignoreNext: () => attempt("skip the next copy", ignoreNextClipboardCopy()),
  }), [attempt, deletion.remove, onPaste, onToggleFavorite, pasteText, say, text.noQr, text.snippetSaved]);

  const saveNote = useCallback((id: string, note: string) => attempt("save a note", setClipboardItemNote(id, note)), [attempt]);
  const saveAsNew = useCallback((value: string) => attempt("save an edit", addClipboardHistoryText(value)), [attempt]);

  return { handlers, notice, deletion, saveNote, saveAsNew, pasteText };
}
