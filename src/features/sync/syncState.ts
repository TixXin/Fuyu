import type { OptionalSyncGroup, SyncBackendKind, SyncCategory, SyncStatus } from "./api";

export const SYNC_CATEGORY_ITEMS: readonly SyncCategory[] = [
  "todos",
  "snippets",
  "links",
  "settings",
  "presets",
  "clipFavorites",
];

export const DEFAULT_ENABLED_CATEGORIES: readonly SyncCategory[] = [
  "todos",
  "snippets",
  "links",
  "settings",
  "presets",
];

export const OPTIONAL_GROUP_ITEMS: readonly OptionalSyncGroup[] = [
  "translationProvider",
  "screenshotCapture",
  "agentSoundOutput",
  "agentPushDelivery",
  "qqMail",
  "collapsedItems",
  "updateChannel",
];

export const STALE_DEVICE_MS = 180 * 24 * 60 * 60 * 1000;

export const DEFAULT_SYNC_STATUS: SyncStatus = {
  phase: "off",
  backend: "off",
  folder: null,
  webdav: null,
  encryption: {
    state: "off",
    hasLocalKey: false,
    keyId: null,
  },
  deviceId: null,
  lastSyncAt: null,
  lastError: null,
  error: null,
  confirm: null,
  categories: SYNC_CATEGORY_ITEMS.map((category) => ({
    category,
    state: DEFAULT_ENABLED_CATEGORIES.includes(category) ? "waiting" : "off",
    message: null,
    lastSyncAt: null,
  })),
  optionalGroups: [],
  devices: [],
  skippedFiles: [],
};

export function activeSyncBackend(status: SyncStatus): SyncBackendKind {
  if (status.backend === "webdav" || status.backend === "folder" || status.backend === "off") {
    return status.backend;
  }
  return status.folder ? "folder" : "off";
}

export function isSyncActive(status: SyncStatus): boolean {
  return activeSyncBackend(status) !== "off";
}

export function enabledCategories(status: SyncStatus): SyncCategory[] {
  return status.categories
    .filter((entry) => entry.state !== "off")
    .map((entry) => entry.category);
}

export function toggleCategoryList(
  current: readonly SyncCategory[],
  target: SyncCategory,
  checked: boolean,
): SyncCategory[] {
  const set = new Set(current);
  if (checked) set.add(target);
  else set.delete(target);
  return SYNC_CATEGORY_ITEMS.filter((item) => set.has(item));
}

export function toggleOptionalGroupList(
  current: readonly OptionalSyncGroup[],
  target: OptionalSyncGroup,
  checked: boolean,
): OptionalSyncGroup[] {
  const set = new Set(current);
  if (checked) set.add(target);
  else set.delete(target);
  return OPTIONAL_GROUP_ITEMS.filter((item) => set.has(item));
}

export function isDeviceStale(lastSyncAt: number, now: number): boolean {
  return lastSyncAt > 0 && now - lastSyncAt > STALE_DEVICE_MS;
}
