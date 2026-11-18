import { invoke } from "@tauri-apps/api/core";
import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ImNotificationItem,
  ImNotificationKind,
  ImSourceId,
  ImSourceSnapshot,
  ImSourceStatus,
} from "./imSourcesState.ts";

export type { ImNotificationItem, ImNotificationKind, ImSourceId, ImSourceSnapshot, ImSourceStatus };

export const IM_SOURCES_CHANGED_EVENT = "im-sources-changed";

export type ImSourcesChangedEvent = {
  source: ImSourceId;
  snapshot: ImSourceSnapshot;
  newestId: string | null;
  replacedId?: string | null;
  windowVisible: boolean;
};

export function getImSourcesState(source?: ImSourceId) {
  return invoke<ImSourceSnapshot[]>("get_im_sources_state", source ? { source } : {});
}

export function setImSourceAutoClear(source: ImSourceId, enabled: boolean) {
  return invoke<ImSourceSnapshot>("set_im_source_auto_clear", { source, enabled });
}

export function clearImSourceNotifications(source: ImSourceId) {
  return invoke<ImSourceSnapshot>("clear_im_source_notifications", { source });
}

export function openImSource(source: ImSourceId) {
  return invoke<void>("open_im_source", { source });
}

export function requestImNotificationAccess() {
  return invoke<string>("request_im_notification_access");
}

export function openImNotificationSettings(access: boolean) {
  return invoke<void>("open_im_notification_settings", { access });
}

export function listenImSourcesChanged(handler: EventCallback<ImSourcesChangedEvent>): Promise<UnlistenFn> {
  return listen<ImSourcesChangedEvent>(IM_SOURCES_CHANGED_EVENT, handler);
}
