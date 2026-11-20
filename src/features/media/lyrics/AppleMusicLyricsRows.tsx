import { useEffect, useState } from "react";
import { useErrorText, useTranslation } from "../../../i18n";
import { SettingsSecretRow } from "../../../components/settings/SettingsSecretRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { deleteAppleMusicToken, hasAppleMusicToken, onAppleMusicTokenChanged, saveAppleMusicToken } from "./api";

export function AppleMusicLyricsRows({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  const text = useTranslation().settings.lyrics.appleMusic;
  const errorText = useErrorText();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void hasAppleMusicToken().then((has) => alive && setSaved(has)).catch(() => alive && setSaved(false));
    const stop = onAppleMusicTokenChanged((has) => alive && setSaved(has));
    return () => {
      alive = false;
      void stop.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [enabled]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      setStatus(done);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      await saveAppleMusicToken(input);
      setInput("");
      setSaved(true);
    }, text.tokenSaved);
  const clear = () =>
    run(async () => {
      await deleteAppleMusicToken();
      setSaved(false);
    }, text.tokenCleared);

  return (
    <>
      <SettingsToggleRow indent title={text.title} description={text.hint} checked={enabled} onChange={onChange} />
      {enabled && (
        <SettingsSecretRow
          indent
          title={text.token}
          description={status ?? (saved ? text.tokenIsSaved : text.tokenHint)}
          value={input}
          placeholder={saved ? text.tokenReplace : text.tokenPlaceholder}
          ariaLabel={text.token}
          hasSecret={Boolean(saved)}
          saving={busy}
          saveLabel={text.save}
          deleteLabel={text.clear}
          onChange={setInput}
          onSave={() => void save()}
          onDelete={() => void clear()}
        />
      )}
    </>
  );
}
