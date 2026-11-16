import type { ReactNode } from "react";
import { defineSlot } from "../../plugin-kernel/slots";
import { PluginNotificationActions } from "../../plugins/PluginNotificationActions";
import { CollapsedMessageContent } from "../CollapsedMessageContent";
import { NotchMessageLeading, NotchMessageTrailing } from "../island/NotchMessage";
import { messagesIsland } from "./islandState";

type SummaryContext = { enabled: boolean; bodyOnly: boolean; children: ReactNode };

const summarySlot = defineSlot<SummaryContext>("island.line/v1");
const lineSlot = defineSlot<object>("island.line/v1");

function MessageSummary({ enabled, bodyOnly, children }: SummaryContext) {
  const preview = messagesIsland.use()?.preview ?? null;
  return <CollapsedMessageContent preview={preview} enabled={enabled} bodyOnly={bodyOnly}>{children}</CollapsedMessageContent>;
}

function MessageLeading() {
  const preview = messagesIsland.use()?.preview;
  return preview ? <NotchMessageLeading preview={preview} /> : null;
}

function MessageTrailing() {
  const preview = messagesIsland.use()?.preview;
  return preview ? <NotchMessageTrailing preview={preview} /> : null;
}

function MessageActions() {
  const messages = messagesIsland.use();
  const notification = messages?.preview?.source === "plugin" ? messages.plugin.notification : null;
  return notification && messages ? <PluginNotificationActions actions={notification.actions} onAction={messages.plugin.runAction} /> : null;
}

summarySlot.add({ id: "messages.summary", component: MessageSummary });
lineSlot.add({ id: "messages.leading", component: MessageLeading });
lineSlot.add({ id: "messages.trailing", component: MessageTrailing });
lineSlot.add({ id: "messages.actions", component: MessageActions });
