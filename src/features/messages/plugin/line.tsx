import type { ReactNode } from "react";
import { defineSlot } from "../../plugin-kernel/slots";
import { PluginNotificationActions } from "../island/PluginNotificationActions";
import { CollapsedMessageContent } from "../CollapsedMessageContent";
import { NotchMessageLeading, NotchMessageTrailing } from "../island/NotchMessage";
import { messagesIsland } from "./islandState";
import { OWNER } from "./owner.ts";

type SummaryContext = { enabled: boolean; bodyOnly: boolean; grow?: boolean; children: ReactNode };

const summarySlot = defineSlot<SummaryContext>("island.line/v1");
const lineSlot = defineSlot<object>("island.line/v1");

function MessageSummary({ enabled, bodyOnly, grow = false, children }: SummaryContext) {
  const preview = messagesIsland.use()?.preview ?? null;
  return <CollapsedMessageContent preview={preview} enabled={enabled} bodyOnly={bodyOnly} grow={grow}>{children}</CollapsedMessageContent>;
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

summarySlot.add({ id: "messages.summary", component: MessageSummary }, OWNER);
lineSlot.add({ id: "messages.leading", component: MessageLeading }, OWNER);
lineSlot.add({ id: "messages.trailing", component: MessageTrailing }, OWNER);
lineSlot.add({ id: "messages.actions", component: MessageActions }, OWNER);
