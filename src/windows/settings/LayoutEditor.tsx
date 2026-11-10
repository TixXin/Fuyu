import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n";
import type { SettingsCategory } from "./categories";
import { SettingsSidebar } from "./SettingsSidebar";
import { useFoundRow, type FoundRow } from "./useFoundRow";
import { WindowControls } from "./WindowControls";
import "./LayoutEditor.css";

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
    <div className="settings-layout">
      {/* The sidebar is its own card, with the window buttons on top (no Windows title bar). */}
      <div className="settings-sidebar-card">
        <WindowControls />
        <SettingsSidebar
          category={category}
          onCategoryChange={onCategoryChange}
          onRowOpen={(page, title) => {
            onCategoryChange(page);
            setFound({ page, title, at: Date.now() });
          }}
        />
      </div>

      {/* Keyed by page so each page opens scrolled to the top. */}
      <div className="editor-panel" key={category} ref={panel}>
        {/* Its empty space drags the window and a double click maximizes, as a title bar would. */}
        <div className="settings-page__header" data-tauri-drag-region>
          <h1 className="settings-page__title" data-tauri-drag-region>{t.settings.categories[category]}</h1>
          {titleAction}
        </div>
        {children}
      </div>
    </div>
  );
}
