import { SquareTerminal, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { errorText } from "../../i18n/nativeError";
import type { useEditorExtensionHint } from "./useEditorExtensionHint";
import "./ArchivedNotice.css";
import "./EditorExtensionHint.css";

export function EditorExtensionHint({ hint: { hint, install, dismiss, close } }: { hint: ReturnType<typeof useEditorExtensionHint> }) {
  const t = useTranslation();
  const text = t.agent.sessions;
  if (!hint) return null;
  const { editor, status } = hint;
  const message =
    status === "done" ? text.extensionDone : status === "failed" ? errorText(hint.error, t) : text.extensionHint(editor.name);

  return (
    <div className="agent-archived agent-extension-hint" role="status">
      <SquareTerminal size={13} strokeWidth={2} aria-hidden="true" />
      <span>{message}</span>
      {status === "offer" || status === "installing" ? (
        <>
          <button type="button" disabled={status === "installing"} onClick={install}>
            {status === "installing" ? text.extensionInstalling : text.extensionInstall}
          </button>
          <button type="button" className="agent-extension-hint__quiet" disabled={status === "installing"} onClick={dismiss}>
            {text.extensionDismiss}
          </button>
        </>
      ) : (
        <button type="button" className="agent-extension-hint__close" aria-label={t.common.close} onClick={close}>
          <X size={12} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
