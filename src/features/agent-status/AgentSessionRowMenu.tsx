import { useEffect, useRef, useState } from "react";
import { AppWindow, Archive, Copy, EyeOff, FolderOpen, Hash } from "lucide-react";
import { RowMenu, type RowMenuItem } from "../../components/list/RowMenu";
import { useTranslation } from "../../i18n";
import { revealAgentSessionFolder, type AgentSessionSummary } from "./api";
import { SESSION_FILTERS_STORAGE_KEY, loadSessionFilters, normalizeSessionFilters, saveSessionFilters } from "./sessionFilters";

const ICON = { size: 14, strokeWidth: 2 } as const;
const MENU_ITEMS = ".row-menu [role=menuitem]:not(:disabled)";

export function hideSessionFolder(path: string) {
  saveSessionFilters(normalizeSessionFilters([...loadSessionFilters(), { kind: "folder", value: path }]));
  window.dispatchEvent(new StorageEvent("storage", { key: SESSION_FILTERS_STORAGE_KEY }));
}

function moveInMenu(event: KeyboardEvent) {
  const items = [...document.querySelectorAll<HTMLButtonElement>(MENU_ITEMS)];
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  if (items.length === 0) return;
  const next =
    event.key === "ArrowDown" ? (at + 1) % items.length
    : event.key === "ArrowUp" ? (at <= 0 ? items.length - 1 : at - 1)
    : event.key === "Home" ? 0
    : event.key === "End" ? items.length - 1
    : null;
  if (next === null) return;
  event.preventDefault();
  items[next].focus();
}

export function AgentSessionRowMenu({
  session,
  title,
  onFocusWindow,
  onArchive,
  onNotice,
  onOpenChange,
}: {
  session: AgentSessionSummary;
  title: string;
  onFocusWindow: () => void;
  onArchive?: () => void;
  onNotice: (text: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslation();
  const text = t.agent.sessions.menu;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const cwd = session.cwd;

  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const frame = window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(MENU_ITEMS)?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (document.activeElement?.closest(".row-menu")) moveInMenu(event);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      const row = anchor?.closest("li")?.querySelector<HTMLElement>(".agent-session, .agent-card");
      if (row && (!document.activeElement || document.activeElement === document.body)) row.focus({ preventScroll: true });
    };
  }, [open]);

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value).then(
      () => onNotice(text.copied),
      (error) => console.error("Failed to copy from the agent session menu", error),
    );
  };

  const items: RowMenuItem[] = [
    { key: "focus", label: text.focus, icon: <AppWindow {...ICON} />, onSelect: onFocusWindow },
    ...(cwd && !session.remoteHost
      ? [{
          key: "reveal",
          label: text.reveal,
          icon: <FolderOpen {...ICON} />,
          onSelect: () => {
            revealAgentSessionFolder(cwd).catch((error) => {
              console.error("Failed to reveal the agent session folder", error);
              onNotice(text.revealFailed);
            });
          },
        }]
      : []),
    { key: "copyPath", label: text.copyPath, icon: <Copy {...ICON} />, disabled: !cwd, onSelect: () => cwd && copy(cwd) },
    { key: "copyId", label: text.copyId, icon: <Hash {...ICON} />, onSelect: () => copy(session.sessionId) },
    ...(onArchive ? [{ key: "archive", label: text.archive, icon: <Archive {...ICON} />, onSelect: onArchive }] : []),
    { key: "hideFolder", label: text.hideFolder, icon: <EyeOff {...ICON} />, disabled: !cwd, onSelect: () => cwd && hideSessionFolder(cwd) },
  ];

  return (
    <span ref={anchorRef} className="agent-session__more">
      <RowMenu
        label={text.label(title)}
        items={items}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
      />
    </span>
  );
}
