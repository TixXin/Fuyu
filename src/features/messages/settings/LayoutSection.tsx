import { SettingsChoiceCards } from "../../../components/settings/SettingsChoiceCards";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useTranslation } from "../../../i18n";
import { MESSAGE_LAYOUTS, type MessageLayout } from "../feed/messageLayout";
import { setMessageLayout, useMessageLayout } from "../plugin/useSourceSwitches";
import { LayoutGlyph } from "./LayoutGlyph";

export function LayoutSection() {
  const text = useTranslation().messages.feed;
  const layout = useMessageLayout();
  return (
    <SettingsGroup title={text.layoutTitle} footer={<SettingsFootnote text={text.layoutHint} />}>
      <SettingsRow title={text.layoutTitle}>
        <SettingsChoiceCards<MessageLayout>
          value={layout}
          ariaLabel={text.layoutTitle}
          columns={3}
          options={MESSAGE_LAYOUTS.map((id) => ({ value: id, label: text.layouts[id].name, hint: text.layouts[id].hint, art: <LayoutGlyph layout={id} /> }))}
          onChange={(next) => { void setMessageLayout(next).catch((error: unknown) => console.error("Could not save the messages layout", error)); }}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
