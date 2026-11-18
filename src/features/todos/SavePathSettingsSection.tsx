import { useEffect, useRef } from "react";
import { Check, FolderOpen } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { pickFolder, revealFolder } from "../../lib/settings-backup/api";
import type { SavePathState } from "./types";
import "./SavePathSettingsSection.css";

export function SavePathSettingsSection({ saveDirectoryDraft, savePathState, highlightSavePath, onSaveDirectoryDraftChange, onSaveDirectory }: {
  saveDirectoryDraft: string;
  savePathState: SavePathState;
  highlightSavePath: boolean;
  onSaveDirectoryDraftChange: (value: string) => void;
  onSaveDirectory: () => void;
}) {
  const t = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!highlightSavePath) return;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightSavePath]);

  const choose = async () => {
    const picked = await pickFolder(t.settings.save.title);
    if (picked) onSaveDirectoryDraftChange(picked);
  };

  const saved = savePathState === "saved";
  return (
    <div ref={panelRef} className={highlightSavePath ? "save-path-panel save-path-panel--attention" : "save-path-panel"}>
      <SettingsGroup title={t.settings.save.title}>
        <SettingsRow
          title={t.settings.save.folder}
          control={
            <>
              {saved ? (
                <span className="save-path-saved">
                  <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                  {t.settings.save.saved}
                </span>
              ) : (
                <SettingsLinkButton onClick={onSaveDirectory}>{t.settings.save.save}</SettingsLinkButton>
              )}
              <SettingsLinkButton onClick={() => void choose()}>{t.common.chooseFolder}</SettingsLinkButton>
              {saveDirectoryDraft.trim() ? (
                <SettingsLinkButton onClick={() => void revealFolder(saveDirectoryDraft.trim())}>
                  <FolderOpen size={13} strokeWidth={2.2} aria-hidden="true" />
                  {isMacOS ? t.common.openFolderMac : t.common.openFolder}
                </SettingsLinkButton>
              ) : null}
            </>
          }
        >
          <SettingsInput
            ref={inputRef}
            monospace
            value={saveDirectoryDraft}
            placeholder={t.settings.save.folderPlaceholder}
            aria-label={t.settings.save.folderLabel}
            onChange={(event) => onSaveDirectoryDraftChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSaveDirectory();
            }}
          />
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
