import { Mail, MessageCircle } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import { messagesIsland } from "./islandState";

type SideContext = {
  onOpenPage: (page: "qq") => void;
};

const sideSlot = defineSlot<SideContext>("island.side/v1");

function UnreadRow({ onOpenPage }: SideContext) {
  const t = useTranslation();
  const messages = messagesIsland.use();
  const unreadCount = (messages?.qq.snapshot.items.length ?? 0) + Number(messages?.wechat.snapshot.pending ?? false);
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

function MailRow() {
  const t = useTranslation();
  const messages = messagesIsland.use();
  return (
    <button
      type="button"
      className="island-side-cell"
      aria-label={t.messages.newMailLabel}
      onClick={(event) => {
        event.stopPropagation();
        messages?.open("qqMail");
      }}
    >
      <Mail size={16} strokeWidth={1.6} aria-hidden="true" />
      <span className="island-side-cell__dot" aria-hidden="true" />
    </button>
  );
}

sideSlot.add({ id: "unread", order: 20, component: UnreadRow });
sideSlot.add({ id: "mail", order: 30, component: MailRow });
