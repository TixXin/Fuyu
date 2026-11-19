import { useRef, useState, type ChangeEvent } from "react";
import { Activity, ExternalLink, FileUp, RefreshCw, Store, Upload } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { SettingsCategory } from "./categories";
import { PluginMenu } from "./PluginMenu";
import { marketClient, openPluginDocs, readPackageFile } from "./pluginMarketActions";
import { offerPluginPackage } from "./pluginPageHandoff";
import "./PluginPage.css";

export function usePluginFilePicker(onPicked: () => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    void readPackageFile(file).then((base64) => {
      offerPluginPackage(file.name, base64);
      onPicked();
    }).catch(() => undefined);
  };
  const input = <input ref={inputRef} className="plugin-file-input" type="file" accept=".fuyu" tabIndex={-1} aria-hidden="true" data-testid="plugin-file-input" onChange={onChange} />;
  return { input, pick: () => inputRef.current?.click() };
}

export function PluginPageActions({ onOpenPage }: { onOpenPage: (page: SettingsCategory) => void }) {
  const text = useTranslation().settings.pluginsV3.page;
  const [manualAllowed, setManualAllowed] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const file = usePluginFilePicker(() => onOpenPage("pluginMarket"));

  const loadManual = () => void marketClient.catalog().then((snapshot) => setManualAllowed(snapshot.manualAllowed)).catch(() => undefined);
  const toggleManual = () => {
    const next = !(manualAllowed ?? false);
    setManualAllowed(next);
    void marketClient.setManualAllowed({ allowed: next }).then((res) => setManualAllowed(res.manualAllowed)).catch(loadManual);
  };
  const checkUpdates = () => {
    setChecking(true);
    void marketClient.refresh().catch(() => undefined).finally(() => setChecking(false));
  };

  return (
    <div className="plugin-page__actions" onPointerDownCapture={() => manualAllowed === null && loadManual()}>
      <button className="plugin-btn" type="button" title={text.browseMarket} data-action="open-market" onClick={() => onOpenPage("pluginMarket")}>
        <Store size={14} strokeWidth={2.2} aria-hidden="true" />
        <span className="plugin-page__action-label">{text.browseMarket}</span>
      </button>
      <PluginMenu
        label={text.moreActions}
        outlined
        items={[
          { key: "install-file", label: text.menu.installFromFile, icon: <Upload size={14} strokeWidth={2} />, onSelect: file.pick },
          { key: "allow-files", label: text.menu.allowFiles, icon: <FileUp size={14} strokeWidth={2} />, checked: manualAllowed ?? false, disabled: manualAllowed === null, hint: text.menu.allowFilesHint, onSelect: toggleManual },
          { key: "check-updates", label: checking ? text.menu.checkingUpdates : text.menu.checkUpdates, icon: <RefreshCw size={14} strokeWidth={2} />, disabled: checking, separatorBefore: true, onSelect: checkUpdates },
          { key: "diagnostics", label: text.menu.diagnostics, icon: <Activity size={14} strokeWidth={2} />, onSelect: () => onOpenPage("pluginDiagnostics") },
          { key: "dev-docs", label: text.menu.devDocs, icon: <ExternalLink size={14} strokeWidth={2} />, onSelect: openPluginDocs },
        ]}
      />
      {file.input}
    </div>
  );
}
