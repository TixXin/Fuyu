import type { ReactNode } from "react";
import { DeviceUseIndicator } from "../../features/device-use/DeviceUseIndicator";
import {
  MailItem,
  MusicItem,
  SessionCountItem,
  ShelfItem,
  StatusLightItem,
  UpdateItem,
  type CollapsedBarContext,
} from "./slots/collapsed";

export type CollapsedBarItem = { id: string; node: ReactNode; group?: "gauges" };

type CollapsedBarItemsInput = CollapsedBarContext & {
  pluginStatus: readonly { id: string; node: ReactNode }[];
};

export function collapsedBarItems({ pluginStatus, ...context }: CollapsedBarItemsInput): CollapsedBarItem[] {
  const { qqMail, updateVersion, deviceUse, shelfCount, showMusic, agentSessionCount, slots } = context;
  const items: CollapsedBarItem[] = [{ id: "status-light", node: <StatusLightItem {...context} /> }];
  if (qqMail.preview !== null) items.push({ id: "mail", node: <MailItem {...context} /> });
  if (updateVersion) items.push({ id: "update", node: <UpdateItem {...context} /> });
  items.push(...pluginStatus);
  items.push({ id: "device-use", node: <DeviceUseIndicator deviceUse={deviceUse} /> });
  if (shelfCount !== null && shelfCount > 0) items.push({ id: "shelf", node: <ShelfItem {...context} /> });
  if (showMusic) items.push({ id: "music", node: <MusicItem {...context} /> });
  for (const gauge of slots.gauges ?? []) items.push({ ...gauge, group: "gauges" });
  if (agentSessionCount !== null && (slots.agentCount || agentSessionCount > 0)) {
    items.push({ id: "session-count", node: <SessionCountItem {...context} /> });
  }
  return items;
}
