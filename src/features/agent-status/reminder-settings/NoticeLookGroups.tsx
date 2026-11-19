import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import "../../../components/settings/SettingsChoiceCards.css";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import type { ThemeTone } from "../../../lib/theme/themeMode";
import { isAgentNoticeDefault } from "../agentNoticeDefaults";
import {
  AGENT_NOTICE_BUTTON_ORDERS,
  AGENT_NOTICE_CLICKS,
  AGENT_NOTICE_COMMAND_LINES,
  AGENT_NOTICE_MESSAGE_LINES,
  AGENT_NOTICE_METAS,
  AGENT_NOTICE_NOTCHES,
  AGENT_NOTICE_SCROLLBARS,
  AGENT_NOTICE_STACKS,
  AGENT_NOTICE_STYLES,
} from "../agentSettings";
import { NoticePreviewCard } from "./NoticePreviewCard";
import { previewShow, type PreviewEvent } from "./previewEvents";
import { useFitScale } from "./useFitScale";
import "./NoticeLookGroups.css";

const THUMB_SCALE = 0.6;
const THUMB_PAD = 14;

type ChoiceKey = "agentNoticeStyle" | "agentNoticeNotch" | "agentNoticeStack" | "agentNoticeMeta" | "agentNoticeScrollbar" | "agentNoticeClick" | "agentNoticeButtonOrder";

type LinesKey = "agentNoticeMessageLines" | "agentNoticeCommandLines";

function NoticeThumb({ event, settings, tone, notch }: { event: PreviewEvent; settings: IslandSettings; tone: ThemeTone; notch: boolean }) {
  const { boxRef, contentRef, scale } = useFitScale({ max: THUMB_SCALE, pad: THUMB_PAD, height: false });
  return (
    <div ref={boxRef} className="agent-reminder-thumb" inert>
      <div ref={contentRef} className="agent-reminder-thumb__fit" style={{ transform: `scale(${scale})` }}>
        <NoticePreviewCard event={event} settings={settings} tone={tone} notch={notch} />
      </div>
    </div>
  );
}

export function NoticeLookGroups({
  settings,
  event,
  tone,
  notch,
  onUpdate,
  onReset,
}: {
  settings: IslandSettings;
  event: PreviewEvent;
  tone: ThemeTone;
  notch: boolean;
  onUpdate: (patch: Partial<IslandSettings>) => void;
  onReset: () => void;
}) {
  const text = useTranslation().settings.agentNotice;
  const thumbEvent = event === "stack" || previewShow(event, settings) !== "card" ? "approval" : event;

  const cards = <K extends "agentNoticeStyle" | "agentNoticeNotch" | "agentNoticeStack">(
    key: K,
    title: string,
    values: readonly IslandSettings[K][],
    labels: Record<IslandSettings[K], string>,
    shown: PreviewEvent,
    withNotch: boolean,
    description?: string,
  ) => (
    <SettingsRow className="agent-reminder-cards" title={title} description={description}>
      <div className="settings-cards" role="group" aria-label={title} style={{ "--cards-columns": values.length } as CSSProperties}>
        {values.map((value) => {
          const active = settings[key] === value;
          return (
            <div key={value} className={`settings-cards__card agent-reminder-cards__card${active ? " settings-cards__card--active" : ""}`}>
              <span className="settings-cards__art" aria-hidden="true">
                <NoticeThumb event={shown} settings={{ ...settings, [key]: value }} tone={tone} notch={withNotch} />
              </span>
              <span className="settings-cards__text">
                <span className="settings-cards__label">{labels[value]}</span>
              </span>
              {active ? <Check className="settings-cards__check" size={14} strokeWidth={2.6} aria-hidden="true" /> : null}
              <button className="agent-reminder-cards__hit" type="button" aria-pressed={active} aria-label={labels[value]} onClick={() => onUpdate({ [key]: value })} />
            </div>
          );
        })}
      </div>
    </SettingsRow>
  );

  const segments = <K extends ChoiceKey>(key: K, title: string, values: readonly IslandSettings[K][], labels: Record<IslandSettings[K], string>, description?: string) => (
    <SettingsRow
      className="agent-reminder-wide"
      title={title}
      description={description}
      control={
        <SettingsChoice
          value={settings[key]}
          options={values.map((value) => ({ value, label: labels[value] }))}
          ariaLabel={title}
          onChange={(value) => onUpdate({ [key]: value })}
        />
      }
    />
  );

  const lines = (key: LinesKey, title: string, values: readonly number[], description?: string) => (
    <SettingsRow
      className="agent-reminder-wide"
      title={title}
      description={description}
      control={
        <SettingsChoice
          value={String(settings[key])}
          options={values.map((value) => ({ value: String(value), label: value === 0 ? text.linesAuto : text.linesValue(value) }))}
          ariaLabel={title}
          onChange={(value) => onUpdate({ [key]: Number(value) })}
        />
      }
    />
  );

  const reset = (
    <SettingsLinkButton disabled={isAgentNoticeDefault(settings)} onClick={onReset}>
      {text.reset}
    </SettingsLinkButton>
  );

  return (
    <>
      <SettingsGroup title={text.lookTitle} action={reset}>
        {cards("agentNoticeStyle", text.style, AGENT_NOTICE_STYLES, text.styleOptions, thumbEvent, notch)}
        {notch && cards("agentNoticeNotch", text.notch, AGENT_NOTICE_NOTCHES, text.notchOptions, thumbEvent, true)}
        {lines("agentNoticeMessageLines", text.messageLines, AGENT_NOTICE_MESSAGE_LINES, text.messageLinesHint)}
        {lines("agentNoticeCommandLines", text.commandLines, AGENT_NOTICE_COMMAND_LINES)}
        <SettingsToggleRow title={text.markdown} description={text.markdownHint} checked={settings.agentNoticeMarkdown} onChange={(agentNoticeMarkdown) => onUpdate({ agentNoticeMarkdown })} />
        {segments("agentNoticeMeta", text.meta, AGENT_NOTICE_METAS, text.metaOptions)}
        {segments("agentNoticeScrollbar", text.scrollbar, AGENT_NOTICE_SCROLLBARS, text.scrollbarOptions)}
      </SettingsGroup>
      <SettingsGroup title={text.behaviorTitle}>
        <SettingsToggleRow title={text.hoverHold} checked={settings.agentNoticeHoverHold} onChange={(agentNoticeHoverHold) => onUpdate({ agentNoticeHoverHold })} />
        {segments("agentNoticeClick", text.click, AGENT_NOTICE_CLICKS, text.clickOptions, text.clickHint)}
        {cards("agentNoticeStack", text.stack, AGENT_NOTICE_STACKS, text.stackOptions, "stack", notch, text.stackHint)}
      </SettingsGroup>
      <SettingsGroup title={text.approvalTitle} footer={<SettingsFootnote text={text.footer} />}>
        {segments("agentNoticeButtonOrder", text.buttonOrder, AGENT_NOTICE_BUTTON_ORDERS, text.buttonOrderOptions)}
        <SettingsToggleRow title={text.shortcuts} description={text.shortcutsHint} checked={settings.agentNoticeShortcuts} onChange={(agentNoticeShortcuts) => onUpdate({ agentNoticeShortcuts })} />
      </SettingsGroup>
    </>
  );
}
