import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n";
import type { SettingsCategory } from "./categories";
import { SettingsSidebar } from "./SettingsSidebar";
import { useFoundRow, type FoundRow } from "./useFoundRow";
import { WindowControls } from "./WindowControls";
import "./LayoutEditor.css";
import "./SettingsSidebarNarrow.css";

export function LayoutEditor({
  category,
  titleAction,
  children,
  onCategoryChange,
}: {
  category: SettingsCategory;
  /** Page-wide control shown at the end of the title row. */
  titleAction?: ReactNode;
  children: ReactNode;
  onCategoryChange: (category: SettingsCategory) => void;
}) {
  const t = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const [found, setFound] = useState<FoundRow | null>(null);
  useFoundRow(found, category, panel);
  return (
    // No Windows title bar: the window's top edge, the card's top and the whole title row drag the
    // window (data-tauri-drag-region counts only clicks on the element itself, not its children).
    <div className="settings-layout" data-tauri-drag-region>
      <WindowControls style="windows" />
      {/* The sidebar is its own card. */}
      <div className="settings-sidebar-card" data-tauri-drag-region>
        <SettingsSidebar
          category={category}
          onCategoryChange={onCategoryChange}
          onRowOpen={(page, title) => {
            onCategoryChange(page);
            setFound({ page, title, at: Date.now() });
          }}
        />
      </div>

      <div className="settings-content">
        {/* Above the scrolling page, so it drags the window wherever the page is scrolled to; a
            double click maximizes, as a title bar would. */}
        <div className="settings-page__header" data-tauri-drag-region>
          <h1 className="settings-page__title" data-tauri-drag-region>{t.settings.categories[category]}</h1>
          {titleAction}
        </div>
        {/* Keyed by page so each page opens scrolled to the top. */}
        <div className="editor-panel" key={category} ref={panel}>
          {children}
        </div>
      </div>
    </div>
  );
}
