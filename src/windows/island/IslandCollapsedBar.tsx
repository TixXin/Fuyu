import { Fragment, type ReactNode } from "react";
import type { QuotaAlert } from "../../features/agent-status/quotaAlerts";
import type { AgentVisualState } from "../../features/agent-status/status";
import type { MediaState } from "../../features/media/api";
import { useAudible } from "../../features/media/useAudible";
import { CollapsedMessageContent } from "../../features/messages/CollapsedMessageContent";
import { useCollapsedBarItems, type CollapsedBarItem } from "./collapsedBarItems";
import type { DeviceUse } from "../../features/device-use/api";
import type { LevelChange } from "../../features/system-levels/api";
import type { DeviceAlert } from "../../features/device-events/api";
import { messagePreviewText, type MessagePreview, type MessageSource } from "../../features/messages/messagePreview";
import type { MailController } from "../../features/messages/mail/MailPanel";
import type { QQNotificationsController } from "../../features/messages/qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../../features/messages/wechat/WeChatReminders";
import { PluginNotificationActions } from "../../features/plugins/PluginNotificationActions";
import type { PluginNotificationsController } from "../../features/plugins/usePluginNotifications";
import { useUpdateReminder } from "../../features/updater/useBackgroundUpdateCheck";
import { arrangeCollapsedItems, zoneIds, type CollapsedZone } from "../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import type { PluginViewEntry } from "../../features/plugin-views/api";
import { usePluginStatusItems } from "../../features/plugin-views/usePluginStatusItems";
import { useTranslation } from "../../i18n";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { leadLine, shownLine, visibleLines } from "../../features/plugin-kernel/islandContributions";
import { runIslandAction, useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { lineSlot, type CollapsedLineContext, type CollapsedLineSources } from "./slots/line";
import type { CollapsedSlots, IslandPage } from "./types";
import { useWindowDragGesture } from "./useWindowDragGesture";
import { hasNotchDrop, useIslandNotch } from "./notch";
import { AlertPopup, NotchAlertLeading, NotchAlertTrailing, useActiveAlert } from "./NotchAlert";
import { NotchMessageLeading, NotchMessageTrailing } from "./NotchMessage";
import { DevWatermark } from "../../components/DevWatermark";
import "./IslandCollapsedBar.css";

type IslandCollapsedBarProps = {
  qqMail: MailController;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  pluginNotifications: PluginNotificationsController;
  preview: MessagePreview | null;
  page: IslandPage;
  isExpanded: boolean;
  isTucked: boolean;
  showTitle: boolean;
  showCollapsedText: boolean;
  collapsedLabel: string;
  lineSources: CollapsedLineSources;
  agentSessionCount: number | null;
  mediaState: MediaState;
  showMusic: boolean;
  shelfCount: number | null;
  deviceUse: DeviceUse;
  levelPopup: LevelChange | null;
  deviceAlert: DeviceAlert | null;
  quotaAlert?: QuotaAlert | null;
  agentVisualState: AgentVisualState;
  onOpenPage: (page: IslandPage) => void;
  onOpenMessages: (source: MessageSource) => void;
  notice?: { content: ReactNode; actions: ReactNode } | null;
  onWindowDragStart: () => void;
  onTuck: () => void;
  pluginViews?: readonly PluginViewEntry[];
  onOpenPluginPage?: (page: `plugin:${string}`) => void;
  slots?: CollapsedSlots;
};

const NO_SLOTS: CollapsedSlots = {};
const NO_VIEWS: readonly PluginViewEntry[] = [];
const ignorePage = () => {};
const OPENS_BAR = "data-opens-bar";

function renderZone(items: readonly CollapsedBarItem[]) {
  const out: ReactNode[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.group) {
      out.push(<Fragment key={item.id}>{item.node}</Fragment>);
      continue;
    }
    const group = [item];
    while (items[index + 1]?.group === item.group) group.push(items[(index += 1)]);
    out.push(<div key={group[0].id} className="island__gauge-slot">{group.map((member) => <Fragment key={member.id}>{member.node}</Fragment>)}</div>);
  }
  return out;
}

export function IslandCollapsedBar({
  qqMail,
  qqNotifications,
  wechatReminders,
  pluginNotifications,
  preview,
  page,
  isExpanded,
  isTucked,
  showTitle,
  showCollapsedText,
  collapsedLabel,
  lineSources,
  agentSessionCount,
  mediaState,
  showMusic,
  shelfCount,
  deviceUse,
  levelPopup,
  deviceAlert,
  quotaAlert = null,
  agentVisualState,
  onOpenPage,
  onOpenMessages,
  notice = null,
  onWindowDragStart,
  onTuck,
  pluginViews = NO_VIEWS,
  onOpenPluginPage = ignorePage,
  slots = NO_SLOTS,
}: IslandCollapsedBarProps) {
  const t = useTranslation();
  const notch = useIslandNotch();
  const updateVersion = useUpdateReminder();
  const audible = useAudible(mediaState.audioActive);
  const { didDragRef, prepareWindowDrag, handleWindowDragMove, cancelWindowDrag } =
    useWindowDragGesture(isTucked, onWindowDragStart);
  const pulseClassName = [
    "island__pulse",
    `island__pulse--agent-${agentVisualState}`,
  ].join(" ");
  const contributed = useIslandContributed();
  const activeAlert = useActiveAlert();
  const alertSources = { deviceAlert, quotaAlert, levelPopup };
  const lines = visibleLines(contributed.lines, showCollapsedText);
  const line = shownLine(lines);
  const peekLine = line?.drop ? line : null;
  const openTarget = (line?.page ?? leadLine(contributed.lines)?.page ?? page) as IslandPage;
  const openPeek = () => {
    if (peekLine?.action) runIslandAction(peekLine.action);
  };
  const lineContext: CollapsedLineContext = { ...lineSources, showTitle, center: slots.center ?? null, agentIcon: slots.agentIcon ?? null };
  const lineView = (id: string) => <SlotView key={id} slot={lineSlot} props={lineContext} select={(items) => items.filter((item) => item.id === id)} />;
  const showCenter = Boolean(slots.center) && !preview && !peekLine && !notice
    && !(showCollapsedText && (showTitle || lines.some((candidate) => candidate.reserve !== true && candidate.measure !== undefined)));
  const pluginStatus = usePluginStatusItems(pluginViews, onOpenPluginPage);
  const { placements: saved } = useCollapsedPlacements();
  const items = useCollapsedBarItems({
    t,
    statusLight: slots.statusLight
      ? <span className="island__mark-light" {...{ [OPENS_BAR]: "" }}>{slots.statusLight}</span>
      : <span className={pulseClassName} {...{ [OPENS_BAR]: "" }} />,
    qqMail,
    updateVersion,
    deviceUse,
    shelfCount,
    showMusic: showMusic && audible,
    mediaState,
    agentSessionCount,
    slots,
    onOpenPage,
    onOpenMessages,
  }, showCollapsedText && !preview && !notice && !peekLine && !activeAlert ? pluginStatus : []);
  const offered = items.map(({ id }) => id);
  const placements = arrangeCollapsedItems(offered, saved);
  const byId = new Map(items.map((item) => [item.id, item]));
  const zone = (name: CollapsedZone) => zoneIds(placements, name, offered).flatMap((id) => byId.get(id) ?? []);

  const left = renderZone(zone("left"));
  const message = (
    <>
        <button
          className={`island__open-button${showCenter ? " island__open-button--center" : ""}`}
          type="button"
          aria-label={preview
            ? t.messages.openPreview(messagePreviewText(preview, t.messages), t.messages.sourceLabels[preview.source])
            : peekLine ? peekLine.label : t.messages.expand(collapsedLabel)}
          data-tooltip=""
          aria-expanded={preview || peekLine ? undefined : isExpanded}
          aria-controls={preview || peekLine ? undefined : "island-panel"}
          onPointerDown={prepareWindowDrag}
          onPointerMove={handleWindowDragMove}
          onPointerUp={cancelWindowDrag}
          onPointerCancel={cancelWindowDrag}
          onClick={(event) => {
            if (event.detail === 0 || !didDragRef.current) {
              if (preview) {
                const source = preview.source;
                if (source === "plugin") {
                  pluginNotifications.dismiss();
                  return;
                }
                if (source === "qqMail" && qqMail.preview) {
                  onOpenMessages("qqMail");
                  void qqMail.readMail(qqMail.preview, qqMail.previewAccount);
                  return;
                }
                const open = source === "qq" ? qqNotifications.openQQ() : wechatReminders.openWeChat(preview.chat);
                void open.then((opened) => {
                  if (opened === false) onOpenMessages(source);
                });
              } else if (peekLine) {
                openPeek();
              } else {
                onOpenPage(openTarget);
              }
            }
          }}
        >
          <CollapsedMessageContent preview={preview} enabled={!isExpanded && !isTucked} bodyOnly={notch !== null}>
            {notice ? notice.content : activeAlert ? (
              <AlertPopup alert={activeAlert} sources={alertSources} />
            ) : line?.bare ? lineView(line.item) : <>
            {showCollapsedText && showTitle && (
              <span className="island__brand">{t.island.appName}</span>
            )}
            {line && lineView(line.item)}
            </>}
          </CollapsedMessageContent>
          {showCenter && <span className="island__center-slot">{slots.center}</span>}
        </button>
        {notice && !preview && notice.actions}
        {!preview && !notice && !activeAlert && !peekLine && contributed.trails.map(lineView)}
        {preview?.source === "plugin" && pluginNotifications.notification && (
          <PluginNotificationActions actions={pluginNotifications.notification.actions} onAction={pluginNotifications.runAction} />
        )}
    </>
  );
  const right = (
    <>
        {renderZone(zone("right"))}
        {agentSessionCount === null && (
          <button
            className="island__quiet-button"
            type="button"
            aria-label={t.island.collapseIsland}
            data-tooltip=""
            onClick={(event) => {
              event.stopPropagation();
              onTuck();
            }}
          />
        )}
    </>
  );
  const alerted = notch !== null && activeAlert !== null;
  const dropped = notch !== null && hasNotchDrop({ preview, notice, translationPeek: peekLine });
  const messaged = notch !== null && !alerted && !notice && preview !== null;
  const wings = alerted ? "alert" : messaged ? `message:${preview?.source}:${preview?.receivedAt}` : dropped ? "dropped" : "idle";

  return (
    <div
      className="island__collapsed"
      aria-hidden={isExpanded}
      inert={isExpanded}
      onClick={(event) => {
        if (event.target === event.currentTarget || (event.target instanceof Element && event.target.hasAttribute(OPENS_BAR))) {
          if (peekLine && !preview) openPeek();
          else onOpenPage(openTarget);
        }
      }}
    >
      <DevWatermark place="collapsed" />
      {notch ? (
        <>
          <div className="island__notch-row">
            <div key={`left:${wings}`} className="island__notch-wing island__notch-wing--left" {...{ [OPENS_BAR]: "" }}>{alerted && activeAlert ? <NotchAlertLeading alert={activeAlert} sources={alertSources} /> : messaged ? <NotchMessageLeading preview={preview} /> : left}</div>
            <span className="island__notch-gap" aria-hidden="true" {...{ [OPENS_BAR]: "" }} />
            <div key={`right:${wings}`} className="island__notch-wing island__notch-wing--right" {...{ [OPENS_BAR]: "" }}>{alerted && activeAlert ? <NotchAlertTrailing alert={activeAlert} sources={alertSources} /> : messaged ? <NotchMessageTrailing preview={preview} /> : dropped ? right : <>{message}{right}</>}</div>
          </div>
          {dropped && <div className="island__notch-drop">{message}</div>}
        </>
      ) : (
        <>
          {left}
          {message}
          {right}
        </>
      )}
    </div>
  );
}
