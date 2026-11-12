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
  titleAction?: ReactNode;
  children: ReactNode;
  onCategoryChange: (category: SettingsCategory) => void;
}) {
  const t = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const [found, setFound] = useState<FoundRow | null>(null);
  useFoundRow(found, category, panel);
  return (
    <div className="settings-layout" data-tauri-drag-region>
      <WindowControls style="windows" />
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
        <div className="settings-page__header" data-tauri-drag-region>
          <h1 className="settings-page__title" data-tauri-drag-region>{t.settings.categories[category]}</h1>
          {titleAction}
        </div>
        <div className="editor-panel" key={category} ref={panel}>
          {children}
        </div>
      </div>
    </div>
  );
}
