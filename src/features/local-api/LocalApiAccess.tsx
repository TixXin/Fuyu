import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { useUnsupportedFeatures } from "../../lib/platform";
import { isBuiltinEnabled } from "../plugin-kernel/builtinSwitches";
import type { SettingsLink } from "../plugin-kernel/settingsCategories";
import { useBuiltinPlugins } from "../plugin-kernel/useBuiltinPlugins";

const TODO_ROUTES = "/v1/todos · /v1/note";
const AGENT_ROUTES = "/v1/agent-status";
const CLIPBOARD_ROUTES = "/v1/clipboard";
const NOTIFY_ROUTES = "/v1/notify";

export function LocalApiAccess({
  allowWrite,
  allowNotify,
  onAllowWriteChange,
  onAllowNotifyChange,
  onOpenPage,
}: {
  allowWrite: boolean;
  allowNotify: boolean;
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
  const link = (page: SettingsLink) => <SettingsLinkButton onClick={() => onOpenPage(page)}>{t.openPage}</SettingsLinkButton>;
  const status = (routes: string, text: string) => `${routes} — ${text}`;

  return (
    <SettingsGroup title={t.accessTitle} footer={<SettingsFootnote text={t.accessHint} />}>
      <SettingsToggleRow title={t.allowWrite} description={t.allowWriteHint} checked={allowWrite} onChange={onAllowWriteChange} />
      <SettingsToggleRow title={t.allowNotify} description={t.allowNotifyHint} checked={allowNotify} onChange={onAllowNotifyChange} />
      <SettingsRow
        title={t.todos}
        description={status(TODO_ROUTES, todos ? (allowWrite ? t.canReadWrite : t.canRead) : t.featureOff)}
        searchable={false}
        control={todos ? null : link("todos")}
      />
      <SettingsRow
        title={t.agents}
        description={status(AGENT_ROUTES, agents ? (allowWrite ? t.canReport : t.needsWrite) : t.featureOff)}
        searchable={false}
        control={agents ? null : link("agents")}
      />
      <SettingsRow
        title={t.notices}
        description={status(NOTIFY_ROUTES, messages ? (allowNotify ? t.canNotify : t.needsNotify) : t.featureOff)}
        searchable={false}
        control={messages ? null : link("messages")}
      />
      {unsupported.has("clipboard") ? null : (
        <SettingsRow
          title={t.clipboard}
          description={status(CLIPBOARD_ROUTES, clipboard ? t.clipboardGrant : t.featureOff)}
          searchable={false}
          control={link(clipboard ? "clipboardHistory" : "clipboard")}
        />
      )}
    </SettingsGroup>
  );
}
