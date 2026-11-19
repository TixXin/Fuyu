import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import type { MessageNotice } from "../../../lib/settings/types";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { requestMessageSample } from "../api";
import "./NoticeStage.css";

type Sample = "qq" | "wechat" | "mail";

const SAMPLE_CODE = "482913";
const SENT_MS = 2400;

export function NoticeStage({ notice, panelSeconds, otp, wechatExposeUi }: {
  notice: MessageNotice;
  panelSeconds: number;
  otp: boolean;
  wechatExposeUi: boolean;
}) {
  const t = useTranslation();
  const labels = t.settings.messageSources.stage;
  const [sample, setSample] = useState<Sample>("qq");
  const [run, setRun] = useState(0);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => setSent(false), SENT_MS);
    return () => window.clearTimeout(timer);
  }, [sent]);

  const message = sample === "mail"
    ? { source: "qqMail" as const, sender: labels.mailSender, body: labels.mailBody(SAMPLE_CODE) }
    : sample === "qq"
      ? { source: "qq" as const, sender: isMacOS ? t.messages.sourceLabels.qq : labels.friend, body: isMacOS ? labels.newMessage : labels.friendBody }
      : wechatExposeUi && !isMacOS
        ? { source: "wechat" as const, sender: labels.wechatFriend, body: labels.wechatBody }
        : { source: "wechat" as const, sender: t.messages.sourceLabels.wechat, body: isMacOS ? labels.newMessage : labels.newReminder };
  const icon = <MessageSourceIcon source={message.source} size={notice === "line" ? 14 : 18} />;
  const copy = sample === "mail" && otp && notice !== "line" ? <span className="notice-stage__copy">{t.messages.copyCode(SAMPLE_CODE)}</span> : null;
  const card = (
    <>
      {icon}
      <span className="notice-stage__text">
        <b>{message.sender}</b>
        <span>{message.body}</span>
      </span>
      <span className="notice-stage__time">{labels.now}</span>
      {copy}
    </>
  );
  const caption = notice === "line" ? labels.captionLine : notice === "banner" ? labels.captionBanner : labels.captionPanel(panelSeconds);

  return (
    <div className="notice-stage" data-search="off">
      <div className="notice-stage__scene" data-notice={notice} key={`${notice}:${sample}:${run}`} role="img" aria-label={`${labels.label}: ${caption}`}>
        <span className="notice-stage__shell" />
        {notice === "line" && (
          <span className="notice-stage__line">
            {icon}
            <b>{message.sender}</b>
            <span>{message.body}</span>
          </span>
        )}
        {notice === "banner" && <span className="notice-stage__banner">{card}</span>}
        {notice === "panel" && (
          <span className="notice-stage__panel">
            <span className="notice-stage__panel-title">{labels.panelTitle(1)}</span>
            <span className="notice-stage__panel-row">{card}</span>
          </span>
        )}
      </div>
      <p className="notice-stage__caption">{caption}</p>
      <div className="notice-stage__controls">
        <SettingsChoice<Sample>
          value={sample}
          ariaLabel={labels.sampleLabel}
          options={[
            { value: "qq", label: labels.sampleQQ },
            { value: "wechat", label: labels.sampleWeChat },
            { value: "mail", label: labels.sampleMail },
          ]}
          onChange={setSample}
        />
        <span className="notice-stage__buttons">
          <SettingsLinkButton onClick={() => setRun(run + 1)}>
            <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" />
            {labels.replay}
          </SettingsLinkButton>
          <SettingsLinkButton disabled={sent} onClick={() => void requestMessageSample().then(() => setSent(true)).catch(() => undefined)}>
            {sent ? labels.trySent : labels.tryOnIsland}
          </SettingsLinkButton>
        </span>
      </div>
    </div>
  );
}
