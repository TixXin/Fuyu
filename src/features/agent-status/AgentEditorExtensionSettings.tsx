import { useEffect, useState } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { errorText } from "../../i18n/nativeError";
import { getEditorExtensionStates, installEditorExtension, type EditorExtensionState } from "./api";

/**
 * Settings → AI Agent → Connection: the island's VS Code extension, which lets a click on a session
 * switch to its terminal inside the editor. Lists the editors found on this computer, each with
 * whether it has the extension and a button that installs it through the editor's command line.
 */
export function AgentEditorExtensionSettings() {
  const t = useTranslation();
  const text = t.settings.agent.editorExtension;
  const [editors, setEditors] = useState<EditorExtensionState[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEditorExtensionStates()
      .then((next) => {
        if (!cancelled) setEditors(next);
      })
      .catch(() => {
        if (!cancelled) setEditors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const install = (editor: EditorExtensionState) => {
    if (busy) return;
    setBusy(editor.app);
    setMessage(null);
    installEditorExtension(editor.app)
      .then(() => {
        setMessage(text.done(editor.name));
        return getEditorExtensionStates().then(setEditors);
      })
      .catch((reason: unknown) => setMessage(errorText(reason, t)))
      .finally(() => setBusy(null));
  };

  return (
    <SettingsGroup
      title={text.title}
      footer={
        <>
          {text.hint}
          {message ? <><br />{message}</> : null}
        </>
      }
    >
      {editors?.length === 0 ? <SettingsRow title={text.none} searchable={false} /> : null}
      {editors?.map((editor) => (
        <SettingsRow
          key={editor.app}
          title={editor.name}
          searchable={false}
          description={!editor.installed && !editor.canInstall ? text.noCli : undefined}
          control={
            editor.installed ? (
              <span className="settings-row__description">{text.installed}</span>
            ) : (
              <SettingsLinkButton disabled={busy !== null} onClick={() => install(editor)}>
                {busy === editor.app ? text.installing : text.install}
              </SettingsLinkButton>
            )
          }
        />
      ))}
    </SettingsGroup>
  );
}
