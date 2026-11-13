import { useEffect, useState, type ReactNode } from "react";
import { FolderOpen, RotateCw } from "lucide-react";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { getDataHome, restartIsland, revealFolder, setDataHome, type DataHome } from "./api";
import { expandHome, shortenHome, userHomeOf } from "./homePath";
import "./SettingsBackupSection.css";

type Status = { kind: "moved"; path: string } | { kind: "error"; message: string };

export function DataHomeSection({ onMoved, onNote }: { onMoved: (from: string, to: string) => void; onNote: (note: ReactNode) => void }) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.dataHome;
  const [home, setHome] = useState<DataHome | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getDataHome()
      .then((current) => {
        if (cancelled || !current) return;
        setHome(current);
        setDraft(shortenHome(current.home, isMacOS ? userHomeOf(current.defaultHome) : null));
      })
      .catch((error: unknown) => console.error("Failed to read the data folder", error));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!home) return null;
  const locked = home.source === "env" || home.source === "appData";
  const userHome = isMacOS ? userHomeOf(home.defaultHome) : null;

  const move = (path: string | null) => {
    const typed = path?.trim() ? expandHome(path.trim(), userHome) : null;
    const target = typed || home.defaultHome;
    if (!target || target === home.home || !window.confirm(text.confirm(shortenHome(target, userHome)))) return;
    void setDataHome(typed)
      .then((moved) => {
        onMoved(home.home, moved);
        setStatus({ kind: "moved", path: shortenHome(moved, userHome) });
      })
      .catch((error: unknown) => setStatus({ kind: "error", message: errorText(error) }));
  };

  const setStatus = (status: Status) => onNote(
    status.kind === "moved" ? (
      <p className="settings-backup__status" role="status">
        <span>{text.moved(status.path)}</span>
        <button className="settings-backup__link" type="button" onClick={() => void restartIsland()}>
          <RotateCw size={12} strokeWidth={2.2} aria-hidden="true" />
          {text.restart}
        </button>
      </p>
    ) : status.kind === "error" ? <p className="settings-backup__status settings-backup__status--error" role="alert">{status.message}</p> : null,
  );

  return (
    <SettingsRow
      title={text.title}
      control={
        <>
          <SettingsLinkButton onClick={() => void revealFolder(home.home)}>
            <FolderOpen size={13} strokeWidth={2.2} aria-hidden="true" />
            {isMacOS ? text.revealMac : text.reveal}
          </SettingsLinkButton>
          {locked ? null : (
            <>
              {home.home !== home.defaultHome && <SettingsLinkButton onClick={() => move(null)}>{text.useDefault}</SettingsLinkButton>}
              <SettingsLinkButton onClick={() => move(draft)}>{text.change}</SettingsLinkButton>
            </>
          )}
        </>
      }
    >
      <SettingsInput
        monospace
        value={draft}
        readOnly={locked}
        aria-label={text.folderLabel}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !locked) move(draft);
        }}
      />
    </SettingsRow>
  );
}
