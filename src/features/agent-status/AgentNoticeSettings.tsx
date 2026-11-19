import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { AGENT_ALERT_SECONDS } from "../../lib/settings/settings";
import type { IslandSettings } from "../../lib/settings/types";
import { agentNoticeDefaults, isAgentNoticeDefault } from "./agentNoticeDefaults.ts";
import {
  AGENT_ALERT_STARTED,
  AGENT_NOTICE_BUTTON_ORDERS,
  AGENT_NOTICE_CLICKS,
  AGENT_NOTICE_COMMAND_LINES,
  AGENT_NOTICE_FAILED_SECONDS,
  AGENT_NOTICE_MESSAGE_LINES,
  AGENT_NOTICE_METAS,
  AGENT_NOTICE_NOTCHES,
  AGENT_NOTICE_SCROLLBARS,
  AGENT_NOTICE_STACKS,
  AGENT_NOTICE_STYLES,
  AGENT_NOTICE_YOUR_TURN_SECONDS,
  DEFAULT_AGENT_SETTINGS,
} from "./agentSettings";

type Props = { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void };

type ChoiceKey = {
  [K in keyof IslandSettings]: IslandSettings[K] extends string ? K : never;
}[keyof IslandSettings];

type NumberKey = {
  [K in keyof IslandSettings]: IslandSettings[K] extends number ? K : never;
}[keyof IslandSettings];

export function AgentNoticeSettings({ settings, onSettingsChange }: Props) {
  const text = useTranslation().settings.agentNotice;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const mark = (isDefault: boolean, label: string) => (isDefault ? text.defaultMark(label) : label);

  const choice = <K extends ChoiceKey>(key: K, title: string, values: readonly IslandSettings[K][], labels: Record<IslandSettings[K] & string, string>, description?: string) => (
    <SettingsRow
      title={title}
      description={description}
      control={
        <SettingsSelect
          value={settings[key] as IslandSettings[K] & string}
          options={values.map((value) => ({ value: value as IslandSettings[K] & string, label: mark(value === DEFAULT_AGENT_SETTINGS[key as keyof typeof DEFAULT_AGENT_SETTINGS], labels[value as IslandSettings[K] & string]) }))}
          ariaLabel={title}
          onChange={(value) => update({ [key]: value } as Partial<IslandSettings>)}
        />
      }
    />
  );

  const numbers = (key: NumberKey, title: string, values: readonly number[], label: (value: number) => string, description?: string) => (
    <SettingsRow
      title={title}
      description={description}
      control={
        <SettingsSelect
          value={String(settings[key])}
          options={values.map((value) => ({ value: String(value), label: mark(value === DEFAULT_AGENT_SETTINGS[key as keyof typeof DEFAULT_AGENT_SETTINGS], label(value)) }))}
          ariaLabel={title}
          onChange={(value) => update({ [key]: Number(value) } as Partial<IslandSettings>)}
        />
      }
    />
  );

  const lines = (value: number) => (value === 0 ? text.linesAuto : text.linesValue(value));
  const stay = (value: number) => (value === 0 ? text.untilSeen : text.closeAfter(value));
  const atDefault = isAgentNoticeDefault(settings);
  const reset = (
    <SettingsLinkButton disabled={atDefault} onClick={() => update(agentNoticeDefaults())}>
      {text.reset}
    </SettingsLinkButton>
  );

  return (
    <>
      <SettingsGroup title={text.lookTitle} action={reset}>
        {choice("agentNoticeStyle", text.style, AGENT_NOTICE_STYLES, text.styleOptions, text.styleHint)}
        {choice("agentNoticeNotch", text.notch, AGENT_NOTICE_NOTCHES, text.notchOptions, text.notchHint)}
        {numbers("agentNoticeMessageLines", text.messageLines, AGENT_NOTICE_MESSAGE_LINES, lines, text.messageLinesHint)}
        {numbers("agentNoticeCommandLines", text.commandLines, AGENT_NOTICE_COMMAND_LINES, lines)}
        <SettingsToggleRow title={text.markdown} description={text.markdownHint} checked={settings.agentNoticeMarkdown} onChange={(agentNoticeMarkdown) => update({ agentNoticeMarkdown })} />
        {choice("agentNoticeMeta", text.meta, AGENT_NOTICE_METAS, text.metaOptions)}
        {choice("agentNoticeScrollbar", text.scrollbar, AGENT_NOTICE_SCROLLBARS, text.scrollbarOptions)}
      </SettingsGroup>
      <SettingsGroup title={text.behaviorTitle}>
        {choice("agentAlertStarted", text.started, AGENT_ALERT_STARTED, text.startedOptions)}
        {numbers("agentNoticeYourTurnSeconds", text.yourTurn, AGENT_NOTICE_YOUR_TURN_SECONDS, stay, text.yourTurnHint)}
        {numbers("agentNoticeFailedSeconds", text.failed, AGENT_NOTICE_FAILED_SECONDS, stay)}
        {numbers("agentAlertSeconds", text.completed, AGENT_ALERT_SECONDS, text.closeAfter, text.completedHint)}
        <SettingsToggleRow title={text.hoverHold} checked={settings.agentNoticeHoverHold} onChange={(agentNoticeHoverHold) => update({ agentNoticeHoverHold })} />
        {choice("agentNoticeClick", text.click, AGENT_NOTICE_CLICKS, text.clickOptions, text.clickHint)}
        {choice("agentNoticeStack", text.stack, AGENT_NOTICE_STACKS, text.stackOptions, text.stackHint)}
      </SettingsGroup>
      <SettingsGroup title={text.approvalTitle} footer={<SettingsFootnote text={text.footer} />}>
        {choice("agentNoticeButtonOrder", text.buttonOrder, AGENT_NOTICE_BUTTON_ORDERS, text.buttonOrderOptions)}
        <SettingsToggleRow title={text.shortcuts} description={text.shortcutsHint} checked={settings.agentNoticeShortcuts} onChange={(agentNoticeShortcuts) => update({ agentNoticeShortcuts })} />
      </SettingsGroup>
    </>
  );
}
