import { Mail, MessageCircle } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import type { MessageSource } from "../messagePreview";

type SideContext = {
  unreadCount: number;
  onOpenPage: (page: "qq") => void;
  onOpenMessages: (source: MessageSource) => void;
};

const sideSlot = defineSlot<SideContext>("island.side/v1");

function UnreadRow({ unreadCount, onOpenPage }: SideContext) {
  const t = useTranslation();
  return (
    <button
      type="button"
      className="island-side-cell"
      aria-label={t.messages.unreadCount(unreadCount)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenPage("qq");
      }}
    >
      <MessageCircle size={16} strokeWidth={1.6} aria-hidden="true" />
      <span className="island-side-cell__num">{unreadCount}</span>
    </button>
  );
}

function MailRow({ onOpenMessages }: SideContext) {
  const t = useTranslation();
  return (
    <button
      type="button"
      className="island-side-cell"
      aria-label={t.messages.newMailLabel}
      onClick={(event) => {
        event.stopPropagation();
        onOpenMessages("qqMail");
      }}
    >
      <Mail size={16} strokeWidth={1.6} aria-hidden="true" />
      <span className="island-side-cell__dot" aria-hidden="true" />
    </button>
  );
}

sideSlot.add({ id: "unread", order: 20, component: UnreadRow });
sideSlot.add({ id: "mail", order: 30, component: MailRow });
