import type { ClipboardListText } from "../../i18n/sections/clipboardList";
import type { ClipboardHistoryItem } from "./api";
import { ALT_KEY } from "./pins.ts";
import { RECENT_RANGES, type RecentRange } from "./recentRange.ts";
import type { PopupAction } from "./popupActions";

export type RecentDelete = { count: (range: RecentRange) => number; remove: (range: RecentRange) => void };

export function withListActions(actions: readonly PopupAction[], item: ClipboardHistoryItem | undefined, text: ClipboardListText, recent?: RecentDelete): PopupAction[] {
  const result = [...actions];
  if (item) {
    const at = result.findIndex((action) => action.id === "favorite") + 1;
    const keys = item.favorite && item.pinKey ? `${ALT_KEY}${item.pinKey}` : undefined;
    result.splice(at, 0, { id: "pinKey", group: "entry", label: text.pinKeyAction, keys, icon: "key", next: "pinKey" });
  }
  if (recent) {
    for (const range of RECENT_RANGES) {
      const count = recent.count(range);
      result.push({ id: `delete-${range}`, group: "record", label: text.deleteRecent[range], note: count ? text.recentCount(count) : text.recentNone, icon: "eraser", run: () => recent.remove(range) });
    }
  }
  return result;
}
