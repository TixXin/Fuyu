import type { ClipboardListText } from "../../i18n/sections/clipboardList";
import type { ClipboardHistoryItem } from "./api";
import { ALT_KEY } from "./pins.ts";
import type { PopupAction } from "./popupActions";

export function withListActions(actions: readonly PopupAction[], item: ClipboardHistoryItem | undefined, text: ClipboardListText): PopupAction[] {
  const result = [...actions];
  if (item) {
    const at = result.findIndex((action) => action.id === "favorite") + 1;
    const keys = item.favorite && item.pinKey ? `${ALT_KEY}${item.pinKey}` : undefined;
    result.splice(at, 0, { id: "pinKey", group: "entry", label: text.pinKeyAction, keys, icon: "key", next: "pinKey" });
  }
  return result;
}
