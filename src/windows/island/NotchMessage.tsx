import { MessageSourceIcon } from "../../features/messages/MessageSourceIcon";
import type { MessagePreview } from "../../features/messages/messagePreview";
import { useTranslation } from "../../i18n";

export function NotchMessageLeading({ preview }: { preview: MessagePreview }) {
  return (
    <span className="notch-alert__icon" aria-hidden="true">
      <MessageSourceIcon source={preview.source} size={16} account={preview.account} iconUrl={preview.iconUrl} />
    </span>
  );
}

export function NotchMessageTrailing({ preview }: { preview: MessagePreview }) {
  const t = useTranslation();
  const from = preview.title.trim() || t.messages.sourceLabels[preview.source];
  return (
    <span className="notch-alert__value notch-message__from" aria-hidden="true">
      <span className="notch-message__name">{from}</span>
    </span>
  );
}
