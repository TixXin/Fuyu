import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { SYNC_STATUS_EVENT, type OptionalSyncGroup, type SyncCategory, type SyncStatus } from "../../src/features/sync/api";
import { DEFAULT_ENABLED_CATEGORIES, SYNC_CATEGORY_ITEMS } from "../../src/features/sync/syncState";

export const LAST_SYNC = Date.UTC(2026, 10, 15, 1, 30);
export const OLD_DEVICE_SYNC = Date.UTC(2026, 1, 1, 0, 0);
export const NEXT_PICKED_FOLDER = "/Users/demo/iCloud/FuyuSync";

export type SyncTestHarness = {
  calls: { command: string; args: Record<string, unknown> }[];
  getStatus: () => SyncStatus;
  emitStatus: (patch: Partial<SyncStatus>) => Promise<void>;
  setWebdavTestError: (error: unknown) => void;
};

export function installSyncSettingsMocks(): SyncTestHarness {
  let currentStatus: SyncStatus = {
    phase: "off",
    backend: "off",
    folder: null,
    webdav: null,
    encryption: { state: "off", hasLocalKey: false, keyId: null },
    deviceId: "mac-studio-01",
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

  const calls: { command: string; args: Record<string, unknown> }[] = [];
  let nextWebdavTestError: unknown = null;

  mockIPC((command, payload) => {
    const args = (payload ?? {}) as Record<string, unknown>;
    calls.push({ command, args });
    switch (command) {
      case "get_sync_status":
        return structuredClone(currentStatus);
      case "plugin:dialog|open":
        return NEXT_PICKED_FOLDER;
      case "plugin:opener|reveal_item_in_dir":
        return null;
      case "set_sync_config": {
        const folder = (args.folder as string | null) ?? null;
        const categories = (args.categories as SyncCategory[]) ?? [];
        const optionalGroups = (args.optionalGroups as OptionalSyncGroup[]) ?? [];
        currentStatus = {
          ...currentStatus,
          backend: folder ? "folder" : "off",
          folder,
          phase: folder ? "idle" : "off",
          lastSyncAt: folder ? LAST_SYNC : null,
          error: null,
          optionalGroups,
          categories: SYNC_CATEGORY_ITEMS.map((category) => ({
            category,
            state: categories.includes(category) ? (folder ? "ok" : "waiting") : "off",
            message: null,
            lastSyncAt: folder && categories.includes(category) ? LAST_SYNC : null,
          })),
          devices: folder
            ? [
                { deviceId: "mac-studio-01", name: "MacBook Air", platform: "macos", appVersion: "0.3.11", lastSyncAt: LAST_SYNC, thisDevice: true },
                { deviceId: "win-desk-02", name: "Office-PC", platform: "windows", appVersion: "0.3.9", lastSyncAt: OLD_DEVICE_SYNC, thisDevice: false },
              ]
            : [],
        };
        return structuredClone(currentStatus);
      }
      case "test_sync_webdav": {
        if (nextWebdavTestError !== null) throw nextWebdavTestError;
        return null;
      }
      case "set_sync_webdav": {
        const url = String(args.url ?? "").trim();
        const username = String(args.username ?? "").trim();
        const categories = (args.categories as SyncCategory[]) ?? [];
        const optionalGroups = (args.optionalGroups as OptionalSyncGroup[]) ?? [];
        currentStatus = {
          ...currentStatus,
          backend: "webdav",
          phase: "idle",
          lastSyncAt: LAST_SYNC,
          lastError: null,
          error: null,
          webdav: { url: url.endsWith("/") ? url : `${url}/`, username, hasPassword: true },
          optionalGroups,
          categories: SYNC_CATEGORY_ITEMS.map((category) => ({
            category,
            state: categories.includes(category) ? "ok" : "off",
            message: null,
            lastSyncAt: categories.includes(category) ? LAST_SYNC : null,
          })),
          devices: [
            { deviceId: "mac-studio-01", name: "MacBook Air", platform: "macos", appVersion: "0.3.11", lastSyncAt: LAST_SYNC, thisDevice: true },
            { deviceId: "win-desk-02", name: "Office-PC", platform: "windows", appVersion: "0.3.9", lastSyncAt: OLD_DEVICE_SYNC, thisDevice: false },
          ],
        };
        return structuredClone(currentStatus);
      }
      case "stop_sync": {
        const forget = Boolean(args.forgetWebdav);
        currentStatus = {
          ...currentStatus,
          backend: "off",
          phase: "off",
          lastError: null,
          error: null,
          webdav: forget ? null : currentStatus.webdav,
        };
        return structuredClone(currentStatus);
      }
      case "sync_now":
        return null;
      case "confirm_sync_deletions": {
        currentStatus = {
          ...currentStatus,
          phase: "idle",
          confirm: null,
          categories: currentStatus.categories.map((entry) =>
            entry.state === "needsConfirm" ? { ...entry, state: "ok", lastSyncAt: LAST_SYNC } : entry,
          ),
        };
        void emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
        return null;
      }
      case "enable_sync_encryption": {
        const pass = String(args.passphrase ?? "").trim();
        if (pass.length < 6) {
          throw { code: "sync.passphraseTooShort", args: { min: "6" }, message: "Too short" };
        }
        currentStatus = {
          ...currentStatus,
          phase: "idle",
          encryption: { state: "unlocked", hasLocalKey: true, keyId: "9f8e7d6c5b4a" },
        };
        void emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
        return structuredClone(currentStatus);
      }
      case "unlock_sync_encryption": {
        const secret = String(args.secret ?? "").trim();
        if (secret === "wrong-passphrase") {
          throw { code: "sync.badPassphrase", message: "Wrong passphrase" };
        }
        currentStatus = {
          ...currentStatus,
          phase: "idle",
          encryption: { state: "unlocked", hasLocalKey: true, keyId: "9f8e7d6c5b4a" },
        };
        void emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
        return structuredClone(currentStatus);
      }
      case "change_sync_passphrase":
        return structuredClone(currentStatus);
      case "disable_sync_encryption": {
        currentStatus = {
          ...currentStatus,
          phase: "idle",
          encryption: { state: "off", hasLocalKey: false, keyId: null },
        };
        void emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
        return structuredClone(currentStatus);
      }
      case "copy_sync_recovery_key":
        return null;
      case "save_sync_recovery_key":
        return "/Users/demo/Downloads/fuyu-sync-recovery-key-2026-11-17-2240.txt";
      case "reset_sync_remote": {
        const pass = typeof args.passphrase === "string" && args.passphrase.trim() ? args.passphrase.trim() : null;
        currentStatus = {
          ...currentStatus,
          phase: "idle",
          encryption: pass
            ? { state: "unlocked", hasLocalKey: true, keyId: "1a2b3c4d5e6f" }
            : { state: "off", hasLocalKey: false, keyId: null },
        };
        void emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
        return structuredClone(currentStatus);
      }
      default:
        return null;
    }
  }, { shouldMockEvents: true });

  return {
    calls,
    getStatus: () => structuredClone(currentStatus),
    emitStatus: async (patch) => {
      currentStatus = { ...currentStatus, ...patch };
      await emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
    },
    setWebdavTestError: (error) => {
      nextWebdavTestError = error;
    },
  };
}
