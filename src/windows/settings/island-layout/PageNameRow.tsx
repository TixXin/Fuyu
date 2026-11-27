import { useRef, useState } from "react";
import { SettingsInput } from "../../../components/settings/SettingsInput";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useTranslation } from "../../../i18n";
import { customPageName, PAGE_NAME_MAX, setIslandPageName, type IslandPagesLayout } from "../../../lib/settings/islandPages";
import type { IslandPageRow } from "./useIslandPageRows";

type PageNameRowProps = {
  row: IslandPageRow;
  layout: IslandPagesLayout;
  save: (layout: IslandPagesLayout) => void;
};

const clip = (value: string) => Array.from(value).slice(0, PAGE_NAME_MAX).join("");

export function PageNameRow({ row, layout, save }: PageNameRowProps) {
  const text = useTranslation().settings.islandPages.icons;
  const saved = customPageName(layout, row.id) ?? "";
  const [draft, setDraft] = useState(saved);
  const composing = useRef(false);
  const inputId = `page-name-${row.id}`;

  const commit = (raw: string) => {
    const value = clip(raw.trimStart());
    setDraft(value);
    save(setIslandPageName(layout, row.id, value));
  };

  return (
    <SettingsRow
      className="page-name-row"
      title={text.nameTitle}
      description={text.nameHint(row.defaultName)}
      labelFor={inputId}
      control={(
        <SettingsInput
          id={inputId}
          className="page-name-row__input"
          value={draft}
          placeholder={row.defaultName}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            commit(event.currentTarget.value);
          }}
          onChange={(event) => {
            if (composing.current) setDraft(event.currentTarget.value);
            else commit(event.currentTarget.value);
          }}
          onBlur={() => setDraft(saved)}
        />
      )}
    />
  );
}
