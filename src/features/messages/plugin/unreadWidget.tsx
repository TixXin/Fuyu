import { MessageCircle } from "lucide-react";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../../i18n";
import { firstPendingImSource, imUnreadTotal } from "../im-sources/imSourcesState";
import type { MessageSource } from "../messagePreview";
import { messagesIsland } from "./islandState";
import "./unreadWidget.css";

type Row = { source: MessageSource; key: "qq" | "wechat" | "mail" | "other"; count: number };

export function UnreadWidget() {
  const t = useTranslation().islandWidgets;
  const messages = messagesIsland.use();
  const on = (source: MessageSource) => messages?.enabledSources?.[source] !== false;
  const qq = messages && on("qq") ? messages.qq.snapshot.items.length : 0;
  const wechat = messages && on("wechat") && messages.wechat.snapshot.pending ? 1 : 0;
  const other = messages?.im ? imUnreadTotal(messages.im.snapshots) : 0;
  const mail = messages && on("qqMail") ? messages.mail.unreadTotal : 0;
  const pendingIm = messages?.im ? firstPendingImSource(messages.im.snapshots) : null;
  const rows: Row[] = [
    { source: "qq" as const, key: "qq" as const, count: qq },
    { source: "wechat" as const, key: "wechat" as const, count: wechat },
    { source: "qqMail" as const, key: "mail" as const, count: mail },
    ...(pendingIm ? [{ source: pendingIm, key: "other" as const, count: other }] : []),
  ].filter((row) => row.count > 0);
  const total = qq + wechat + other;
  const open = () => messages?.open(rows[0]?.source ?? messages.source);
  return (
    <WidgetFrame icon={MessageCircle} title={t.widgets.unread} className="unread-widget">
      <button
        className="unread-widget__open"
        type="button"
        aria-label={t.widgets.unread}
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
      >
        {rows.length ? (
          <>
            <span className="island-widget__big unread-widget__total">{total || mail}</span>
            <span className="unread-widget__rows">
              {rows.map((row) => (
                <span key={row.key} className="unread-widget__row" data-source={row.key} title={t.content.sources[row.key]}>
                  <i aria-hidden="true" />
                  {row.count}
                </span>
              ))}
            </span>
          </>
        ) : (
          <span className="island-widget__empty">{t.content.noUnread}</span>
        )}
      </button>
    </WidgetFrame>
  );
}
