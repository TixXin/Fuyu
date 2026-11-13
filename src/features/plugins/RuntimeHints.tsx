import { ExternalLink } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { openPluginHomepage, POWERSHELL_DOWNLOAD_URL, type PluginRuntimeRequirement } from "./api";
import { NodeMissingHint } from "./NodeMissingHint";
import { runsOn } from "./platforms";

export function RuntimeHints({ runtime, platforms, nodeAvailable, powershellAvailable }: {
  runtime: PluginRuntimeRequirement | null;
  platforms: readonly string[] | undefined;
  nodeAvailable: boolean;
  powershellAvailable: boolean;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const text = t.settings.plugins;
  if (!runsOn(isMacOS ? "macos" : "windows", runtime, platforms)) {
    return <p className="plugin-card__hint plugin-card__hint--warn">{isMacOS ? text.notForMac : text.notForWindows}</p>;
  }
  if (runtime === "node" && !nodeAvailable) return <NodeMissingHint />;
  if (runtime === "powershell" && !powershellAvailable) {
    return (
      <div className="plugin-node-hint">
        <p className="plugin-card__hint">{text.powershellMissing}</p>
        <button className="plugin-card__button" type="button" onClick={() => void openPluginHomepage(POWERSHELL_DOWNLOAD_URL[locale])}>
          <ExternalLink size={12} strokeWidth={2.4} />
          <span>{text.getPowershell}</span>
        </button>
      </div>
    );
  }
  return null;
}
