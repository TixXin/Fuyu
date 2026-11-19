import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { SettingsAdvanced } from "../../../components/settings/SettingsAdvanced";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { useTranslation } from "../../../i18n";
import { isMacOS, type PlatformFeature } from "../../../lib/platform";
import { onSectionFocus, takePendingSection } from "../../../lib/settings/sectionFocus";
import type { IslandSettings } from "../../../lib/settings/types";
import { openSystemPermission } from "../../../lib/system-permissions/api";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { sortImSourcesForSettings, type ImSourceId } from "../im-sources/imSourcesState";
import type { ImSourcesController } from "../im-sources/useImSources";
import { useMailAccounts } from "../mail/useMailAccounts";
import { useMailEnabled } from "../plugin/useSourceSwitches";
import type { QQNotificationsController } from "../qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../wechat/WeChatReminders";
import { ImSourceRows, QQSourceRows, WeChatSourceRows } from "./ChatSourceRows";
import { MailSourceRows, staleMailboxes } from "./MailSourceRows";
import { SourcesSummary } from "./SourcesSummary";
import { needsAccess, summarizeSources, type ChatSource, type ChatSourceState } from "./sourceRows.ts";
import "./MessageSources.css";

export type SourcesSectionProps = {
  settings: IslandSettings;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  imSources: ImSourcesController;
  unsupported: ReadonlySet<PlatformFeature>;
};

function useScrollToMail() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const show = (section: string) => {
      if (section !== "mail" && section !== "messagesMail") return;
      root.current?.querySelector(".source-row--mail")?.scrollIntoView({ block: "center" });
    };
    if (takePendingSection("mail")) show("mail");
    if (takePendingSection("messagesMail")) show("mail");
    return onSectionFocus(show);
  }, []);
  return root;
}

export function SourcesSection({ settings, qqNotifications, wechatReminders, imSources, unsupported }: SourcesSectionProps) {
  const t = useTranslation();
  const labels = t.settings.messageSources;
  const mail = useMailAccounts({ restore: false });
  const mailOn = useMailEnabled(settings.mailEnabled);
  const root = useScrollToMail();
  const [keptFolded, setKeptFolded] = useState<ReadonlySet<ImSourceId>>(new Set());
  const hasQQ = !unsupported.has("qq");
  const hasWeChat = !unsupported.has("wechat");
  const ordered = sortImSourcesForSettings(imSources.snapshots, { isMacOS });
  const shown = ordered.filter((id) => imSources.snapshots[id].installed || (imSources.snapshots[id].enabled && !keptFolded.has(id)));
  const folded = ordered.filter((id) => !shown.includes(id));

  const chats: Array<ChatSourceState & { source: ChatSource }> = [
    ...(hasQQ ? [{ source: "qq" as const, enabled: qqNotifications.snapshot.enabled, status: qqNotifications.snapshot.status, error: qqNotifications.actionError || qqNotifications.snapshot.error }] : []),
    ...(hasWeChat ? [{ source: "wechat" as const, enabled: wechatReminders.snapshot.enabled, status: wechatReminders.snapshot.status, error: wechatReminders.actionError || wechatReminders.snapshot.error }] : []),
    ...ordered.map((source) => ({ source, enabled: imSources.snapshots[source].enabled, status: imSources.snapshots[source].status, error: imSources.actionErrors[source] || imSources.snapshots[source].error })),
  ];
  const summary = summarizeSources(chats, { enabled: mailOn, stale: staleMailboxes(mail) }, isMacOS);
  const waiting = isMacOS ? chats.filter(needsAccess) : [];
  const icons = [
    ...chats.filter((chat) => chat.enabled).map((chat) => <MessageSourceIcon key={chat.source} source={chat.source} size={18} />),
    ...(mailOn ? [<MessageSourceIcon key="mail" source="qqMail" size={18} />] : []),
  ];

  const mainHint = [
    hasQQ || hasWeChat ? (isMacOS ? labels.mainHintMac : labels.mainHint) : "",
    mailOn ? (isMacOS ? t.mail.accountsHintMac : t.mail.accountsHint) : "",
  ].filter(Boolean).join(" ");

  const grantAccess = () => {
    const first = waiting[0];
    if (!first || first.source === "wechat") return void openSystemPermission("accessibility").catch(() => undefined);
    const asks = first.status === "permissionRequired";
    if (first.source === "qq") return void (asks ? qqNotifications.requestAccess() : qqNotifications.openSettings());
    return void (asks ? imSources.requestAccess(first.source) : imSources.openSettings(first.source));
  };

  return (
    <div className="source-settings" ref={root}>
      <SourcesSummary icons={icons} summary={summary} hint={isMacOS ? labels.summaryHintMac : labels.summaryHint} />
      {waiting.length > 0 && (
        <section className="settings-group">
          <div className="source-alert" role="alert" data-search="off">
            <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
            <span className="source-alert__text">
              <strong>{labels.accessTitleMac}</strong>
              <span>{labels.accessBodyMac}</span>
            </span>
            <SettingsLinkButton onClick={grantAccess}>{labels.accessActionMac}</SettingsLinkButton>
          </div>
        </section>
      )}
      <SettingsGroup
        title={labels.mainTitle}
        footer={mainHint ? <SettingsFootnote text={mainHint} /> : undefined}
      >
        {hasQQ && <QQSourceRows controller={qqNotifications} />}
        {hasWeChat && <WeChatSourceRows controller={wechatReminders} />}
        <MailSourceRows enabled={mailOn} mail={mail} />
      </SettingsGroup>
      <SettingsGroup
        title={labels.imOthersTitle}
        action={<span className="source-settings__note">{labels.othersNote}</span>}
        footer={<SettingsFootnote text={isMacOS ? labels.imOthersHintMac : labels.imOthersHint} />}
      >
        {shown.map((source) => <ImSourceRows key={source} source={source} imSources={imSources} />)}
        {folded.length > 0 && (
          <SettingsAdvanced label={labels.moreApps(folded.length)} openLabel={labels.fewerApps(folded.length)}>
            {folded.map((source) => (
              <ImSourceRows key={source} source={source} imSources={imSources} onToggled={() => setKeptFolded((kept) => new Set(kept).add(source))} />
            ))}
          </SettingsAdvanced>
        )}
      </SettingsGroup>
    </div>
  );
}
