import { useLayoutEffect } from "react";
import type { ShortcutOwner } from "./shortcutConflicts";
import { reportShortcutOwners } from "./shortcutOwnerStore";

export function useReportShortcutOwners(id: string, order: number, owners: readonly ShortcutOwner[], finderOnly = false) {
  const key = JSON.stringify(owners);
  useLayoutEffect(() => reportShortcutOwners(id, { order, owners: JSON.parse(key) as ShortcutOwner[], finderOnly }), [id, order, key, finderOnly]);
}
