import { useTranslation } from "../../../i18n";
import { runnerSlot } from "../../../windows/settings/slots/runnerSlot";
import { useReportShortcutOwners } from "../../../windows/settings/useReportShortcutOwners";
import { normalizeClipboardShortcut } from "../shortcut";
import { useClipboardSettings } from "../useClipboardSettings";

function ClipboardShortcutOwners() {
  const t = useTranslation();
  const [clipboard] = useClipboardSettings();
  useReportShortcutOwners("clipboard", 20, clipboard.enabled && clipboard.shortcutEnabled
    ? [{ id: "clipboard", label: t.settings.clipboard.shortcut, shortcut: normalizeClipboardShortcut(clipboard.shortcut), home: "clipboard" }]
    : []);
  return null;
}

runnerSlot.add({ id: "clipboard.shortcut-owners", component: ClipboardShortcutOwners });
