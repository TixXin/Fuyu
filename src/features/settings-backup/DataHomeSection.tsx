import { useEffect, useState } from "react";
import { FolderOpen, RotateCw } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { getDataHome, restartIsland, revealFolder, setDataHome, type DataHome } from "./api";
import "./SettingsBackupSection.css";

type Status = { kind: "idle" } | { kind: "moved"; path: string } | { kind: "error"; message: string };

export function DataHomeSection({ onMoved }: { onMoved: (from: string, to: string) => void }) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.dataHome;
  const [home, setHome] = useState<DataHome | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    void getDataHome()
      .then((current) => {
        if (cancelled || !current) return;
        setHome(current);
        setDraft(current.home);
      })
      .catch((error: unknown) => console.error("Failed to read the data folder", error));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!home) return null;
  const locked = home.source === "env" || home.source === "appData";

  const move = (path: string | null) => {
    const target = path?.trim() || home.defaultHome;
    if (!target || target === home.home || !window.confirm(text.confirm(target))) return;
    void setDataHome(path?.trim() || null)
      .then((moved) => {
        onMoved(home.home, moved);
        setStatus({ kind: "moved", path: moved });
      })
      .catch((error: unknown) => setStatus({ kind: "error", message: errorText(error) }));
  };

  const footer = (
    <>
      <p>{home.source === "env" ? text.fromEnv : text.hint}</p>
      {status.kind === "moved" && (
        <p className="settings-backup__status" role="status">
          <span>{text.moved(status.path)}</span>
          <button className="settings-backup__link" type="button" onClick={() => void restartIsland()}>
            <RotateCw size={12} strokeWidth={2.2} aria-hidden="true" />
            {text.restart}
          </button>
        </p>
      )}
      {status.kind === "error" && <p className="settings-backup__status settings-backup__status--error" role="alert">{status.message}</p>}
    </>
  );

  return (
    <SettingsGroup
      title={text.title}
      action={
        <SettingsLinkButton onClick={() => void revealFolder(home.home)}>
          <FolderOpen size={13} strokeWidth={2.2} aria-hidden="true" />
          {isMacOS ? text.revealMac : text.reveal}
        </SettingsLinkButton>
      }
      footer={footer}
    >
      <SettingsRow
        title={text.folder}
        control={
          locked ? null : (
            <>
              {home.home !== home.defaultHome && <SettingsLinkButton onClick={() => move(null)}>{text.useDefault}</SettingsLinkButton>}
              <SettingsLinkButton onClick={() => move(draft)}>{text.change}</SettingsLinkButton>
            </>
          )
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
    </SettingsGroup>
  );
}
