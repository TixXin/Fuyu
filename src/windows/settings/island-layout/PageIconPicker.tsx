import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { FuyuTextIcon } from "../../../components/island-widget/FuyuTextIcon";
import { JellyfishIcon } from "../../../components/island-widget/JellyfishIcon";
import type { PanelIconComponent } from "../../../components/island-widget/panelIcons";
import { FUYU_TEXT_ICON, JELLYFISH_ICON, PAGE_ICON_CHOICES } from "../../../components/island-widget/pageIcons";
import { useTranslation } from "../../../i18n";
import { FUYU_PAGE_ID } from "../../../lib/settings/customPanels";
import { setIslandPageIcon, type IslandPagesLayout } from "../../../lib/settings/islandPages";
import type { IslandPageRow } from "./useIslandPageRows";
import "./PageIconPicker.css";

const DEFAULT = "";

type PageIconPickerProps = {
  row: IslandPageRow;
  layout: IslandPagesLayout;
  save: (layout: IslandPagesLayout) => void;
  legacyJellyfish: boolean;
};

export function PageIconPicker({ row, layout, save, legacyJellyfish }: PageIconPickerProps) {
  const text = useTranslation().settings.islandPages.icons;
  const fuyu = row.id === FUYU_PAGE_ID;
  const lead: [string, string, PanelIconComponent][] = fuyu
    ? [[FUYU_TEXT_ICON, text.text, FuyuTextIcon], [JELLYFISH_ICON, text.jellyfish, JellyfishIcon]]
    : [[DEFAULT, text.useDefault, row.defaultIcon]];
  const options = [...lead, ...Object.entries(PAGE_ICON_CHOICES).map(([name, Icon]): [string, string, PanelIconComponent] => [name, text.names[name] ?? name, Icon])];
  const current = row.iconName ?? DEFAULT;
  const pick = (name: string) => {
    const keep = name === DEFAULT || (fuyu && name === FUYU_TEXT_ICON && !legacyJellyfish);
    save(setIslandPageIcon(layout, row.id, keep ? null : name));
  };

  return (
    <SettingsGroup title={text.title(row.name)} footer={fuyu ? text.fuyuHint : text.hint}>
      <div className="page-icon-picker" role="radiogroup" aria-label={text.title(row.name)} data-page={row.id}>
        {options.map(([name, label, Icon]) => (
          <button
            key={name || "default"}
            className="page-icon-picker__option"
            type="button"
            role="radio"
            aria-checked={current === name}
            aria-label={label}
            title={label}
            data-icon={name || "default"}
            data-wide={name === FUYU_TEXT_ICON || name === DEFAULT || undefined}
            onClick={() => pick(name)}
          >
            <Icon size={name === FUYU_TEXT_ICON ? 18 : 16} strokeWidth={1.8} />
            {name === DEFAULT ? <span>{label}</span> : null}
          </button>
        ))}
      </div>
    </SettingsGroup>
  );
}
