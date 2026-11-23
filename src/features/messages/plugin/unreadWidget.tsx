import { MessageCircle } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../../i18n";
import { firstPendingImSource, imUnreadTotal } from "../im-sources/imSourcesState";
import type { MessageSource } from "../messagePreview";
import { messagesIsland } from "./islandState";
import { unreadRows, type UnreadRow } from "./unreadRows.ts";
import "./unreadWidget.css";

export function UnreadWidget() {
  const t = useTranslation().islandWidgets;
  const messages = messagesIsland.use();
  const on = (source: MessageSource) => messages?.enabledSources?.[source] !== false;
  const qq = messages && on("qq") ? messages.qq.snapshot.items.length : 0;
  const wechat = Boolean(messages && on("wechat") && messages.wechat.snapshot.pending);
  const other = messages?.im ? imUnreadTotal(messages.im.snapshots) : 0;
  const mail = messages && on("qqMail") ? messages.mail.unreadTotal : 0;
  const pendingIm = messages?.im ? firstPendingImSource(messages.im.snapshots) : null;
  const { rows, total } = unreadRows({ qq, wechat, mail, other, pendingIm });
  const label = (row: UnreadRow) => (row.count === null ? t.content.wechatPending : `${t.content.sources[row.key]} ${row.count}`);
  const summary = rows.length ? [total > 0 ? t.content.unreadSummary(total) : null, ...rows.map(label)].filter(Boolean).join(", ") : t.content.noUnread;
  const open = () => messages?.open(rows[0]?.source ?? messages.source);
  return (
    <WidgetFrame icon={MessageCircle} title={t.widgets.unread} className="unread-widget">
      <button className="unread-widget__open" type="button" aria-label={`${t.widgets.unread}: ${summary}`} title={summary} onClick={clickOnly(open)}>
        {rows.length ? (
          <>
            {total > 0 ? (
              <span className="island-widget__big unread-widget__total">{total > 999 ? "999+" : total}</span>
            ) : (
              <span className="island-widget__headline unread-widget__new">{t.content.newMessages}</span>
            )}
            <span className="unread-widget__rows">
              {rows.map((row) => (
                <span key={row.key} className="unread-widget__row" data-source={row.key} title={label(row)}>
                  <i aria-hidden="true" />
                  {row.count ?? t.content.sources[row.key]}
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
