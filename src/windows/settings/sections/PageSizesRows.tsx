import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { packageLabel } from "../../../features/plugin-kernel/slotTitle";
import { useTranslation } from "../../../i18n";
import { FUYU_PAGE_ID } from "../../../lib/settings/customPanels";
import { customPageName } from "../../../lib/settings/islandPages";
import type { IslandSettings, PanelPageSize } from "../../../lib/settings/types";
import { useIslandPages } from "../../../lib/settings/useIslandPages";

type PageSizesRowsProps = {
  pageSizes: IslandSettings["pageSizes"];
  onChange: (pageSizes: IslandSettings["pageSizes"]) => void;
};

export function PageSizesRows({ pageSizes, onChange }: PageSizesRowsProps) {
  const t = useTranslation();
  const text = t.settings.layout;
  const pages = t.settings.islandPages.page;
  const { layout } = useIslandPages();
  const entries = Object.entries(pageSizes);
  const name = (page: string) =>
    customPageName(layout, page) ?? (page === FUYU_PAGE_ID ? t.island.homePage : Object.prototype.hasOwnProperty.call(pages, page) ? pages[page as keyof typeof pages] : packageLabel(page));
  const without = (page: string) => Object.fromEntries(entries.filter(([key]) => key !== page));
  const size = ({ width, height }: PanelPageSize) => text.pageSizeValue(width, height);

  return (
    <>
      <SettingsRow
        title={text.pageSizes}
        description={text.pageSizesHint}
        control={(
          <SettingsLinkButton disabled={entries.length === 0} onClick={() => onChange({})}>
            {text.pageSizesReset}
          </SettingsLinkButton>
        )}
      />
      {entries.map(([page, value]) => (
        <SettingsRow
          key={page}
          indent
          searchable={false}
          title={name(page)}
          description={size(value)}
          control={<SettingsLinkButton onClick={() => onChange(without(page))}>{text.pageSizeReset}</SettingsLinkButton>}
        />
      ))}
    </>
  );
}
