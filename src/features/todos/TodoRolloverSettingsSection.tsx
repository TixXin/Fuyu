import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsMultiChoice } from "../../components/settings/SettingsMultiChoice";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import {
  TODO_DAY_START_HOURS,
  type TodoArchiveRetentionDays,
  type TodoDayStartHour,
  type TodoPrefs,
} from "./todoPrefs.ts";
import { TodoNoteTemplateRow } from "./TodoNoteTemplateRow";
import { useTodoPrefs } from "./useTodoPrefs";
import "./TodoRolloverSettingsSection.css";

type MarkdownMetaKey = "project" | "priority" | "subtasks" | "note" | "elapsed";

const MARKDOWN_META_PREFS: Readonly<Record<MarkdownMetaKey, keyof TodoPrefs & `markdown${string}`>> = {
  project: "markdownProject",
  priority: "markdownPriority",
  subtasks: "markdownSubtasks",
  note: "markdownNote",
  elapsed: "markdownElapsed",
};
const MARKDOWN_META_KEYS = Object.keys(MARKDOWN_META_PREFS) as MarkdownMetaKey[];
type DayStartOptionValue = `${TodoDayStartHour}`;
type RetentionOptionValue = `${TodoArchiveRetentionDays}`;

export function TodoRolloverSettingsSection({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.todo;
  const [prefs, setPrefs] = useTodoPrefs();

  const dayStartOptions: readonly { value: DayStartOptionValue; label: string }[] = TODO_DAY_START_HOURS.map((hour) => ({
    value: `${hour}`,
    label: hour === 0 ? text.dayStartMidnight : `${String(hour).padStart(2, "0")}:00`,
  }));

  const markdownMetaValues = MARKDOWN_META_KEYS.filter((key) => prefs[MARKDOWN_META_PREFS[key]]);

  const markdownMetaOptions: readonly { value: MarkdownMetaKey; label: string }[] = MARKDOWN_META_KEYS.map((key) => ({
    value: key,
    label: text.markdownMetaOptions[key],
  }));

  const retentionOptions: readonly { value: RetentionOptionValue; label: string }[] = [
    { value: "0", label: text.archiveRetentionOptions.forever },
    { value: "90", label: text.archiveRetentionOptions.days90 },
    { value: "180", label: text.archiveRetentionOptions.days180 },
    { value: "365", label: text.archiveRetentionOptions.days365 },
  ];

  return (
    <>
    <SettingsGroup title={text.rolloverGroup}>
      <SettingsRow
        title={text.dayStartHour}
        description={text.dayStartHourHint}
        control={
          <SettingsSelect
            value={`${prefs.dayStartHour}` as DayStartOptionValue}
            options={dayStartOptions}
            ariaLabel={text.dayStartHour}
            onChange={(value) => setPrefs((current) => ({ ...current, dayStartHour: Number(value) as TodoDayStartHour }))}
          />
        }
      />
      <SettingsToggleRow
        title={text.carryOverIncomplete}
        checked={settings.carryOverIncompleteTodos}
        onChange={(carryOverIncompleteTodos) => onSettingsChange({ ...settings, carryOverIncompleteTodos })}
      />
      <SettingsToggleRow
        title={text.recurrenceHolidayAware}
        description={text.recurrenceHolidayAwareHint}
        checked={prefs.recurrenceHolidayAware}
        onChange={(recurrenceHolidayAware) => setPrefs((current) => ({ ...current, recurrenceHolidayAware }))}
      />
      <TodoNoteTemplateRow />
    </SettingsGroup>
    <SettingsGroup title={text.markdownGroup}>
      <SettingsRow title={text.markdownMeta}>
        <div className="settings-row__control todo-markdown-meta">
          <SettingsMultiChoice
            values={markdownMetaValues}
            options={markdownMetaOptions}
            ariaLabel={text.markdownMeta}
            onToggle={(key, selected) => setPrefs((current) => ({ ...current, [MARKDOWN_META_PREFS[key]]: selected }))}
          />
        </div>
      </SettingsRow>
    </SettingsGroup>
    <SettingsGroup title={text.archiveGroup}>
      <SettingsRow
        title={text.archiveRetention}
        description={text.archiveRetentionHint}
        control={
          <SettingsSelect
            value={`${prefs.archiveRetentionDays}` as RetentionOptionValue}
            options={retentionOptions}
            ariaLabel={text.archiveRetention}
            onChange={(value) => setPrefs((current) => ({ ...current, archiveRetentionDays: Number(value) as TodoArchiveRetentionDays }))}
          />
        }
      />
      <SettingsToggleRow
        title={text.showWeekSummary}
        description={text.showWeekSummaryHint}
        checked={prefs.showWeekSummary}
        onChange={(showWeekSummary) => setPrefs((current) => ({ ...current, showWeekSummary }))}
      />
    </SettingsGroup>
    </>
  );
}
