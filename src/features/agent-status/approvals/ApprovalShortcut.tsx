const parts = (shortcut: string) => shortcut.split("+");

export function ApprovalShortcut({ shortcut }: { shortcut: string | undefined }) {
  if (!shortcut) return null;
  return <kbd className="agent-approval__key" aria-hidden="true">{parts(shortcut).pop()}</kbd>;
}

export function ApprovalShortcutModifiers({ shortcut }: { shortcut: string | undefined }) {
  if (!shortcut || parts(shortcut).length < 2) return null;
  return <span className="agent-approval__modifiers" aria-hidden="true">{`${parts(shortcut).slice(0, -1).join("+")}+`}</span>;
}
