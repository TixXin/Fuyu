import { IslandGlyph } from "../../../components/settings/IslandGlyph";
import { SettingsChoiceCards } from "../../../components/settings/SettingsChoiceCards";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { MESSAGE_PANEL_SECONDS } from "../../../lib/settings/settings";
import type { IslandSettings, MessageNotice } from "../../../lib/settings/types";
import { setMessageAutoClearEnabled, setMessageOtpCopyEnabled, useMessageAutoClear, useMessageOtpCopyEnabled } from "../plugin/useSourceSwitches";
import type { WeChatRemindersController } from "../wechat/WeChatReminders";
import { NoticeStage } from "./NoticeStage";

export function NoticeSection({ settings, wechatReminders, onSettingsChange }: {
  settings: IslandSettings;
  wechatReminders: WeChatRemindersController;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const labels = useTranslation().settings.messageSources;
  const otpCopyEnabled = useMessageOtpCopyEnabled();
  const autoClear = useMessageAutoClear();

  return (
    <>
      <SettingsGroup title={labels.noticeTitle} footer={<SettingsFootnote text={labels.noticeHint} />}>
        <NoticeStage
          notice={settings.messageNotice}
          panelSeconds={settings.messagePanelSeconds}
          otp={otpCopyEnabled}
          wechatExposeUi={wechatReminders.snapshot.exposeUi}
        />
        <SettingsRow title={labels.noticeLabel}>
          <SettingsChoiceCards<MessageNotice>
            value={settings.messageNotice}
            ariaLabel={labels.noticeLabel}
            options={[
              { value: "line", label: labels.noticeLine, hint: labels.noticeLineHint, art: <IslandGlyph state="collapsed" /> },
              { value: "banner", label: labels.noticeBanner, hint: labels.noticeBannerHint, art: <IslandGlyph state="banner" /> },
              { value: "panel", label: labels.noticePanel, hint: labels.noticePanelHint, art: <IslandGlyph state="expanded" /> },
            ]}
            onChange={(messageNotice) => onSettingsChange({ ...settings, messageNotice })}
          />
        </SettingsRow>
        {settings.messageNotice === "panel" && (
          <SettingsRow
            title={labels.panelSeconds}
            indent
            control={
              <SettingsSelect
                value={String(settings.messagePanelSeconds)}
                options={MESSAGE_PANEL_SECONDS.map((seconds) => ({ value: String(seconds), label: labels.panelSecondsValue(seconds) }))}
                ariaLabel={labels.panelSeconds}
                onChange={(value) => onSettingsChange({ ...settings, messagePanelSeconds: Number(value) })}
              />
            }
          />
        )}
      </SettingsGroup>
      <SettingsGroup title={labels.afterTitle}>
        <SettingsToggleRow
          title={labels.otpCopyLabel}
          description={labels.otpCopyDescription}
          checked={otpCopyEnabled}
          onChange={(on) => void setMessageOtpCopyEnabled(on)}
        />
        <SettingsToggleRow
          title={labels.autoClearLabel}
          description={isMacOS ? labels.autoClearDescriptionMac : labels.autoClearDescription}
          checked={autoClear}
          onChange={(on) => void setMessageAutoClearEnabled(on)}
        />
      </SettingsGroup>
    </>
  );
}
