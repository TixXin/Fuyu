import { isMacOS } from "../../../lib/platform";
import { shortcutKey, shortcutModifiers } from "./approvalShortcutText";

export function ApprovalShortcut({ shortcut }: { shortcut: string | undefined }) {
  if (!shortcut) return null;
  return <kbd className="agent-approval__key" aria-hidden="true">{shortcutKey(shortcut)}</kbd>;
}

export function ApprovalShortcutModifiers({ shortcut }: { shortcut: string | undefined }) {
  const modifiers = shortcut ? shortcutModifiers(shortcut) : "";
  if (!modifiers) return null;
  return (
    <span className={`agent-approval__modifiers${isMacOS ? " agent-approval__modifiers--symbols" : ""}`} aria-hidden="true">
      {modifiers}
    </span>
  );
}
