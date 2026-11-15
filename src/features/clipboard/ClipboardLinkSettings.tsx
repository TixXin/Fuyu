import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { exportClipboardLinks, importClipboardLinks, revealExportedFile, type ClipboardLinkMatching } from "./api";
import { ClipboardSiteListRow } from "./ClipboardSiteListRow";
import { useClipboardLinks } from "./useClipboardLinks";

type Status = { kind: "exported"; path: string } | { kind: "imported"; count: number } | { kind: "error"; message: string } | null;

export function ClipboardLinkSettings({ iconsOn }: { iconsOn: boolean }) {
  const t = useTranslation().clipboard.links;
  const text = t.settings;
  const errorText = useErrorText();
  const links = useClipboardLinks();
  const settings = links.links.settings;
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const change = (patch: Partial<typeof settings>) => void links.setSettings({ ...settings, ...patch });

  const run = (task: () => Promise<Status>) => {
    setBusy(true);
    task()
      .then(setStatus, (error: unknown) => setStatus({ kind: "error", message: errorText(error) }))
      .finally(() => setBusy(false));
  };
  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) run(async () => ({ kind: "imported", count: await importClipboardLinks(await file.text()) }));
  };

  return (
    <SettingsGroup title={text.title}>
      <SettingsToggleRow title={text.notice} description={iconsOn ? text.noticeHint : `${text.noticeHint} ${text.iconsHint}`} checked={settings.notice} onChange={(notice) => change({ notice })} />
      {settings.notice && (
        <SettingsRow
          indent
          title={text.matching}
          control={
            <SettingsChoice<ClipboardLinkMatching>
              value={settings.matching}
              ariaLabel={text.matching}
              options={[
                { value: "any", label: text.matchingOptions.any },
                { value: "web", label: text.matchingOptions.web },
              ]}
              onChange={(matching) => change({ matching })}
            />
          }
        />
      )}
      {settings.notice && (
        <ClipboardSiteListRow id="clipboard-link-blocked" title={text.blocked} description={text.blockedHint} placeholder={text.sitesPlaceholder} sites={settings.blockedSites} onChange={(blockedSites) => change({ blockedSites })} />
      )}
      {settings.notice && (
        <ClipboardSiteListRow id="clipboard-link-only" title={text.only} description={text.onlyHint} placeholder={text.sitesPlaceholder} sites={settings.onlySites} onChange={(onlySites) => change({ onlySites })} />
      )}
      <SettingsRow
        title={text.export}
        description={text.exportHint}
        control={
          <SettingsLinkButton onClick={() => run(async () => ({ kind: "exported", path: await exportClipboardLinks() }))} disabled={busy}>
            <Download size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.exportAction}
          </SettingsLinkButton>
        }
      />
      <SettingsRow
        title={text.import}
        description={text.importHint}
        control={
          <>
            <SettingsLinkButton onClick={() => fileInput.current?.click()} disabled={busy}>
              <Upload size={13} strokeWidth={2.2} aria-hidden="true" />
              {text.importAction}
            </SettingsLinkButton>
            <input ref={fileInput} hidden type="file" accept=".json,.txt,application/json,text/plain" aria-label={text.import} onChange={importFile} />
          </>
        }
      />
      {status && (
        <SettingsRow
          searchable={false}
          title={status.kind === "error" ? text.failed : status.kind === "exported" ? text.exported : text.imported(status.count)}
          description={status.kind === "error" ? status.message : status.kind === "exported" ? status.path : undefined}
          control={status.kind === "exported" && (
            <SettingsLinkButton onClick={() => void revealExportedFile(status.path)}>{isMacOS ? text.showMac : text.show}</SettingsLinkButton>
          )}
        />
      )}
    </SettingsGroup>
  );
}
