import type { LucideIcon } from "lucide-react";
import { ariaShortcut, shortcutTitle } from "../approvals/approvalShortcutText";
import type { AgentNoticeButtonOrder } from "../agentSettings";
import { orderedActions } from "./noticeOptions";
import "./NoticeActions.css";

export type NoticeAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  shortcut?: string;
  hint?: string;
};

export function NoticeActions({ actions, order, showKeys }: { actions: NoticeAction[]; order: AgentNoticeButtonOrder; showKeys: boolean }) {
  return (
    <div className={`agent-notice__actions${showKeys ? "" : " agent-notice__actions--no-keys"}`}>
      {orderedActions(actions, order).map(({ id, label, icon: Icon, onClick, disabled, primary, shortcut, hint }) => {
        const keys = shortcutTitle(shortcut);
        const title = [hint, keys && `(${keys})`].filter(Boolean).join(" ") || undefined;
        return (
          <button
            key={id}
            className={`agent-notice__button agent-notice__button--${id}${primary ? " agent-notice__button--primary" : ""}`}
            type="button"
            disabled={disabled}
            title={title}
            aria-label={label}
            aria-keyshortcuts={ariaShortcut(shortcut)}
            onClick={onClick}
          >
            <span className="agent-notice__label">{label}</span>
            <Icon className="agent-notice__button-icon" size={14} strokeWidth={2.3} aria-hidden="true" />
            {keys && <kbd className="agent-notice__key" aria-hidden="true">{keys}</kbd>}
          </button>
        );
      })}
    </div>
  );
}
