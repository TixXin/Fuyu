import { useEffect, useRef } from "react";
import type { MailController } from "../mail/MailPanel";
import type { MessageView } from "../Messages";
import type { MessageSource } from "../messagePreview";
import { resolveMessageSource } from "./messageSource";

export function useMailSwitch(mailSwitch: boolean, mail: MailController) {
  const configured = mail.anyConfigured;
  const receiving = mail.anyReceiving;
  const setReceiving = mail.setAllEnabled;
  const lastSwitchRef = useRef(mailSwitch);
  useEffect(() => {
    if (!configured) return;
    if (!mailSwitch && receiving) {
      void setReceiving(false);
    } else if (mailSwitch && !lastSwitchRef.current && !receiving) {
      void setReceiving(true);
    }
    lastSwitchRef.current = mailSwitch;
  }, [configured, receiving, mailSwitch, setReceiving]);
}

export function useSourceFallback(source: MessageView, enabled: Readonly<Record<MessageSource, boolean>>, setSource: (source: MessageView) => void) {
  const { qq, wechat, qqMail } = enabled;
  useEffect(() => {
    const next = resolveMessageSource(source, { qq, wechat, qqMail });
    if (next !== source) setSource(next);
  }, [source, qq, wechat, qqMail, setSource]);
}
