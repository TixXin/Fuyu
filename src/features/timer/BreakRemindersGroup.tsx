import { Coffee, Plus } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { BreakReminderRow } from "./BreakReminderRow";
import { MAX_ITEMS, newBreakReminder, type BreakReminder } from "./breakReminders";
import { useBreakReminderSettings } from "./useBreakReminderSettings";

function freshId(items: readonly BreakReminder[]) {
  let index = items.length + 1;
  while (items.some((item) => item.id === `custom-${index}`)) index += 1;
  return `custom-${index}`;
}

export function BreakRemindersGroup() {
  const t = useTranslation().timer.breaks;
  const [settings, update] = useBreakReminderSettings();
  const { items } = settings;
  const full = items.length >= MAX_ITEMS;
  const placeholder = (item: BreakReminder) =>
    item.id === "sit" ? t.sitName : item.id === "eyes" ? t.eyesName : t.iconNames[item.icon];
  const setItems = (next: BreakReminder[]) => update({ ...settings, items: next });

  return (
    <SettingsGroup title={t.title}>
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<Coffee size={15} strokeWidth={1.9} />}>{t.toggle}</SettingsIconTitle>}
        description={t.hint}
        checked={settings.enabled}
        onChange={(enabled) => update({ ...settings, enabled })}
      />
      {settings.enabled ? (
        <>
          {items.map((item) => (
            <BreakReminderRow
              key={item.id}
              item={item}
              placeholder={placeholder(item)}
              onChange={(next) => setItems(items.map((entry) => (entry.id === item.id ? next : entry)))}
              onRemove={() => setItems(items.filter((entry) => entry.id !== item.id))}
            />
          ))}
          <SettingsRow
            indent
            searchable={false}
            title={items.length === 0 ? t.empty : ""}
            description={full ? t.full : undefined}
            control={
              <SettingsLinkButton disabled={full} onClick={() => setItems([...items, newBreakReminder(freshId(items))])}>
                <Plus size={13} strokeWidth={2} aria-hidden="true" /> {t.add}
              </SettingsLinkButton>
            }
          />
        </>
      ) : null}
    </SettingsGroup>
  );
}
