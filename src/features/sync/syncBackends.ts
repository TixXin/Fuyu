import type { ComponentType } from "react";
import type { SyncStatus } from "./api";

export type SyncBackendId = "folder" | "webdav";

export type SyncSectionProps = {
  status: SyncStatus;
  busy: boolean;
};

export type SyncBackendEntry = {
  id: SyncBackendId;
  component?: ComponentType<SyncSectionProps>;
};

export const SYNC_BACKENDS: readonly SyncBackendEntry[] = [
  { id: "folder" },
  { id: "webdav" },
];

export const SYNC_SECURITY_SECTIONS: readonly ComponentType<SyncSectionProps>[] = [];
