import { Bell, Bot, ClipboardList, ListTodo } from "lucide-react";
import { SettingsCapabilityGrid, type CapabilityItem } from "../../components/settings/SettingsCapabilityGrid";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { useUnsupportedFeatures } from "../../lib/platform";
import { isBuiltinEnabled } from "../plugin-kernel/builtinSwitches";
import type { SettingsLink } from "../plugin-kernel/settingsCategories";
import { useBuiltinPlugins } from "../plugin-kernel/useBuiltinPlugins";

export function LocalApiAccess({
  allowWrite,
  allowNotify,
  disabled = false,
  onAllowWriteChange,
  onAllowNotifyChange,
  onOpenPage,
}: {
  allowWrite: boolean;
  allowNotify: boolean;
  disabled?: boolean;
  onAllowWriteChange: (next: boolean) => void;
  onAllowNotifyChange: (next: boolean) => void;
  onOpenPage: (page: SettingsLink) => void;
}) {
  const t = useTranslation().settings.localApi;
  const plugins = useBuiltinPlugins();
  const unsupported = useUnsupportedFeatures();
  const todos = isBuiltinEnabled(plugins, "todos");
  const agents = isBuiltinEnabled(plugins, "agents");
  const clipboard = isBuiltinEnabled(plugins, "clipboard");
  const messages = isBuiltinEnabled(plugins, "messages");
  const link = (page: SettingsLink) => (
    <SettingsLinkButton disabled={disabled} onClick={() => onOpenPage(page)}>
      {t.openPage}
    </SettingsLinkButton>
  );

  const capabilities: CapabilityItem[] = [
    {
      id: "todos",
      icon: <ListTodo size={15} strokeWidth={2} />,
      title: t.todos,
      routes: ["/v1/todos", "/v1/note"],
      badge: !todos ? t.featureOff : allowWrite ? t.canReadWrite : t.canRead,
      tone: !todos ? "off" : allowWrite ? "ok" : "info",
      note: !todos ? t.featureOffNote : undefined,
      action: todos ? undefined : link("todos"),
    },
    {
      id: "agents",
      icon: <Bot size={15} strokeWidth={2} />,
      title: t.agents,
      routes: ["/v1/agent-status"],
      badge: !agents ? t.featureOff : allowWrite ? t.canReport : t.needsWrite,
      tone: !agents ? "off" : allowWrite ? "ok" : "warn",
      note: !agents ? t.featureOffNote : undefined,
      action: agents ? undefined : link("agents"),
    },
    {
      id: "notices",
      icon: <Bell size={15} strokeWidth={2} />,
      title: t.notices,
      routes: ["/v1/notify"],
      badge: !messages ? t.featureOff : allowNotify ? t.canNotify : t.needsNotify,
      tone: !messages ? "off" : allowNotify ? "ok" : "warn",
      note: !messages ? t.featureOffNote : undefined,
      action: messages ? undefined : link("messages"),
    },
  ];

  if (!unsupported.has("clipboard")) {
    capabilities.push({
      id: "clipboard",
      icon: <ClipboardList size={15} strokeWidth={2} />,
      title: t.clipboard,
      routes: ["/v1/clipboard"],
      badge: clipboard ? t.clipboardBadge : t.featureOff,
      tone: clipboard ? "info" : "off",
      note: clipboard ? t.clipboardGrant : t.featureOffNote,
      action: link(clipboard ? "clipboardHistory" : "clipboard"),
    });
  }

  return (
    <>
      <SettingsGroup title={t.accessTitle}>
        <SettingsToggleRow
          title={t.allowWrite}
          description={t.allowWriteHint}
          checked={allowWrite}
          disabled={disabled}
          onChange={onAllowWriteChange}
        />
        <SettingsToggleRow
          title={t.allowNotify}
          description={t.allowNotifyHint}
          checked={allowNotify}
          disabled={disabled}
          onChange={onAllowNotifyChange}
        />
      </SettingsGroup>
      <SettingsGroup title={t.capabilitiesTitle} plain footer={<SettingsFootnote text={t.accessHint} />}>
        <SettingsCapabilityGrid items={capabilities} />
      </SettingsGroup>
    </>
  );
}
