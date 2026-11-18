import { useEffect, useState, type ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { SettingsFolderRow } from "../../../components/settings/SettingsFolderRow";
import { SettingsConfirmBar } from "../../../components/settings/SettingsInlineConfirm";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { useErrorText, useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { getDataHome, restartIsland, setDataHome, type DataHome } from "../../../lib/settings-backup/api";
import { expandHome, shortenHome, userHomeOf } from "../../../lib/settings-backup/homePath";
import "./SettingsBackupSection.css";

type Status = { kind: "moved"; path: string } | { kind: "error"; message: string };
type PendingMove = { typed: string | null; shown: string };

export function DataHomeSection({ onMoved, onNote }: { onMoved: (from: string, to: string) => void; onNote: (note: ReactNode) => void }) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.dataHome;
  const [home, setHome] = useState<DataHome | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingMove | null>(null);

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

  const requestMove = (path: string | null) => {
    const typed = path?.trim() ? expandHome(path.trim(), userHome) : null;
    const target = typed || home.defaultHome;
    if (!target || target === home.home) return;
    setPending({ typed, shown: shortenHome(target, userHome) });
  };

  const applyMove = (move: PendingMove) => {
    setPending(null);
    void setDataHome(move.typed)
      .then((moved) => {
        onMoved(home.home, moved);
        setHome((current) => (current ? { ...current, home: moved } : current));
        setDraft(shortenHome(moved, userHome));
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
    <SettingsFolderRow
      title={text.title}
      description={locked && home.source === "env" ? text.fromEnv : undefined}
      value={draft}
      readOnly={locked}
      ariaLabel={text.folderLabel}
      revealPath={home.home}
      revealLabel={isMacOS ? text.revealMac : text.reveal}
      browseTitle={text.title}
      resetLabel={home.home !== home.defaultHome ? text.useDefault : undefined}
      onChange={(next) => {
        setDraft(next);
        setPending(null);
      }}
      onSubmit={() => requestMove(draft)}
      onPick={(picked) => {
        const shortened = shortenHome(picked, userHome);
        setDraft(shortened);
        requestMove(shortened);
      }}
      onReset={home.home !== home.defaultHome ? () => requestMove(null) : undefined}
      extraControl={!locked ? <SettingsLinkButton onClick={() => requestMove(draft)}>{text.change}</SettingsLinkButton> : null}
    >
      {pending ? (
        <SettingsConfirmBar
          message={text.confirm(pending.shown)}
          confirmLabel={text.confirmAction}
          onConfirm={() => applyMove(pending)}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </SettingsFolderRow>
  );
}
