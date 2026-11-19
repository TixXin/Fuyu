import type { ReactNode } from "react";
import { Boxes, Cpu, Database, FileText, Globe, LayoutPanelTop, Package, PackagePlus, Repeat, ShieldCheck, TerminalSquare } from "lucide-react";
import type { PluginMarketPermissionKind } from "../../i18n/sections/settings/pluginMarket";
import { useLocale, useTranslation } from "../../i18n";
import type { PermissionItem } from "./pluginMarketModel";
import "./PluginDetailModal.css";

const ICONS: Record<PluginMarketPermissionKind, ReactNode> = {
  network: <Globe size={14} strokeWidth={2} />,
  noNetwork: <ShieldCheck size={14} strokeWidth={2} />,
  runPrograms: <TerminalSquare size={14} strokeWidth={2} />,
  files: <FileText size={14} strokeWidth={2} />,
  nodeSensitive: <Cpu size={14} strokeWidth={2} />,
  nodeApis: <Boxes size={14} strokeWidth={2} />,
  island: <LayoutPanelTop size={14} strokeWidth={2} />,
  provides: <Package size={14} strokeWidth={2} />,
  replaces: <Repeat size={14} strokeWidth={2} />,
  alsoInstalls: <PackagePlus size={14} strokeWidth={2} />,
};

const MODULE_KINDS = new Set<PluginMarketPermissionKind>(["runPrograms", "files", "nodeSensitive", "nodeApis"]);

export function PluginMarketPermissions({ items, nameOf, ownData = false }: { items: readonly PermissionItem[]; nameOf?: (id: string) => string; ownData?: boolean }) {
  const text = useTranslation().settings.pluginsV3.marketPage.perms;
  const { locale } = useLocale();
  const join = (list: readonly string[]) => list.join(locale === "en" ? ", " : "、");
  const detailOf = (item: PermissionItem) => {
    if (item.kind === "noNetwork") return text.noNetworkDetail;
    if (MODULE_KINDS.has(item.kind)) return text.usesModules(join(item.detail));
    if (item.kind === "alsoInstalls") return join(item.detail.map((id) => nameOf?.(id) ?? id));
    return join(item.detail);
  };
  return (
    <div className="plugin-card market-perms">
      {items.map((item) => (
        <div key={item.kind} className={`plugin-perm${item.sensitive ? " plugin-perm--sensitive" : ""}`} data-permission={item.kind}>
          <span className="plugin-perm__icon" aria-hidden="true">{ICONS[item.kind]}</span>
          <b>{text.titles[item.kind]}</b>
          <span>{detailOf(item)}</span>
        </div>
      ))}
      {ownData ? (
        <div className="plugin-perm" data-permission="ownData">
          <span className="plugin-perm__icon" aria-hidden="true"><Database size={14} strokeWidth={2} /></span>
          <b>{text.ownData}</b>
          <span>{text.ownDataNote}</span>
        </div>
      ) : null}
    </div>
  );
}
