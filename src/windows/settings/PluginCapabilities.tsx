import type { ReactNode } from "react";
import { Boxes, Cpu, FileText, Globe, Repeat, TerminalSquare } from "lucide-react";
import type { PluginCapabilityKind } from "../../i18n/sections/settings/pluginMarket";
import { useLocale, useTranslation } from "../../i18n";
import { capabilityItems, type CapabilityItem, type PluginCapabilities as Capabilities } from "./pluginMarketModel";
import "./PluginDetailModal.css";

const ICONS: Record<PluginCapabilityKind, ReactNode> = {
  replaces: <Repeat size={14} strokeWidth={2} />,
  network: <Globe size={14} strokeWidth={2} />,
  runPrograms: <TerminalSquare size={14} strokeWidth={2} />,
  files: <FileText size={14} strokeWidth={2} />,
  nodeSensitive: <Cpu size={14} strokeWidth={2} />,
  nodeApis: <Boxes size={14} strokeWidth={2} />,
};

const MODULE_KINDS = new Set<PluginCapabilityKind>(["runPrograms", "files", "nodeSensitive"]);

export function PluginCapabilities({ caps }: { caps: Capabilities }) {
  const text = useTranslation().settings.pluginsV3.marketPage.capabilities;
  const { locale } = useLocale();
  const items = capabilityItems(caps);
  if (items.length === 0) return null;
  const join = (list: readonly string[]) => list.join(locale === "en" ? ", " : "、");
  const detailOf = (item: CapabilityItem) => (MODULE_KINDS.has(item.kind) ? text.usesModules(join(item.detail)) : join(item.detail));
  return (
    <section className="plugin-caps" data-plugin-capabilities>
      <h3 className="plugin-page__heading">{text.heading}</h3>
      <div className="plugin-card">
        {items.map((item) => (
          <div key={item.kind} className={`plugin-cap${item.sensitive ? " plugin-cap--sensitive" : ""}`} data-capability={item.kind}>
            <span className="plugin-cap__icon" aria-hidden="true">{ICONS[item.kind]}</span>
            <b>{text.titles[item.kind]}</b>
            <span>{detailOf(item)}</span>
          </div>
        ))}
      </div>
      <p className="plugin-foot">{text.note}</p>
    </section>
  );
}
