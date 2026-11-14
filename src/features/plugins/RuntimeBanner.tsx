import { ExternalLink } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { NODE_DOWNLOAD_URL, openPluginHomepage, POWERSHELL_DOWNLOAD_URL, type PluginRuntimeRequirement } from "./api";
import { runtimeProblem } from "./runtimeProblem";
import "./RuntimeBanner.css";

export function RuntimeBanner({ plugins, nodeAvailable, powershellAvailable }: {
  plugins: readonly { runtime: PluginRuntimeRequirement | null; platforms?: readonly string[] }[];
  nodeAvailable: boolean;
  powershellAvailable: boolean;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const text = t.settings.plugins;
  const count = (kind: "node" | "powershell") =>
    plugins.filter((plugin) => runtimeProblem(isMacOS ? "macos" : "windows", plugin.runtime, plugin.platforms, nodeAvailable, powershellAvailable) === kind).length;
  const rows = [
    { kind: "node", count: count("node"), message: text.nodeMissingCount, label: text.getNode, url: NODE_DOWNLOAD_URL[locale] },
    { kind: "powershell", count: count("powershell"), message: text.powershellMissingCount, label: text.getPowershell, url: POWERSHELL_DOWNLOAD_URL[locale] },
  ].filter((row) => row.count > 0);

  return (
    <>
      {rows.map((row) => (
        <div key={row.kind} className="plugin-runtime-banner" role="status">
          <p>{row.message(row.count)}</p>
          <button className="plugin-card__button" type="button" onClick={() => void openPluginHomepage(row.url)}>
            <ExternalLink size={12} strokeWidth={2.4} />
            <span>{row.label}</span>
          </button>
        </div>
      ))}
    </>
  );
}
