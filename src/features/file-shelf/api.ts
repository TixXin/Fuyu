import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export type FileShelfItem = {
  id: string;
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  addedAt: number;
  pinned: boolean;
  missing: boolean;
  unreachable: boolean;
};

export type FileShelfSnapshot = {
  items: FileShelfItem[];
};

export type FileShelfOptions = {
  maxItems: number;
  maxAgeDays: number;
  removeMissing: boolean;
};

export function getFileShelf() {
  return invoke<FileShelfSnapshot>("get_file_shelf");
}

export function setFileShelfOptions(options: FileShelfOptions) {
  return invoke<FileShelfSnapshot>("set_file_shelf_options", { options });
}

export function addFileShelfPaths(paths: string[]) {
  return invoke<FileShelfSnapshot>("add_file_shelf_paths", { paths });
}

export function removeFileShelfItems(ids: string[]) {
  return invoke<FileShelfSnapshot>("remove_file_shelf_items", { ids });
}

export function toggleFileShelfPin(id: string) {
  return invoke<FileShelfSnapshot>("toggle_file_shelf_pin", { id });
}

export function getFileShelfThumbnail(id: string) {
  return invoke<string | null>("get_file_shelf_thumbnail", { id });
}

export function clearFileShelf() {
  return invoke<FileShelfSnapshot>("clear_file_shelf");
}

export function copyFileShelfItems(ids: string[]) {
  return invoke<void>("copy_file_shelf_items", { ids });
}

export function openFileShelfItem(id: string) {
  return invoke<void>("open_file_shelf_item", { id });
}

export function revealFileShelfItem(id: string) {
  return invoke<void>("reveal_file_shelf_item", { id });
}

export function startFileShelfDrag(ids: string[], removeAfter: boolean) {
  return invoke<FileShelfSnapshot>("start_file_shelf_drag", { ids, removeAfter });
}

export type FileDropEvent =
  | { type: "enter"; paths: string[] }
  | { type: "drop"; paths: string[] }
  | { type: "leave" };

export function listenFileDrop(handler: (event: FileDropEvent) => void): Promise<UnlistenFn> {
  return getCurrentWebview().onDragDropEvent(({ payload }) => {
    if (payload.type === "enter" || payload.type === "drop") {
      handler({ type: payload.type, paths: payload.paths });
    } else if (payload.type === "leave") {
      handler({ type: "leave" });
    }
  });
}

const FILE_SHELF_CHANGED_EVENT = "file-shelf-changed";

export function listenFileShelfChanged(onChange: () => void) {
  return listen(FILE_SHELF_CHANGED_EVENT, () => onChange());
}
