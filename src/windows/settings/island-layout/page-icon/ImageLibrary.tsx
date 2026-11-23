import { X } from "lucide-react";
import type { PanelIconComponent } from "../../../../components/island-widget/panelIcons";
import { useTranslation } from "../../../../i18n";
import type { PageIconImage } from "../../../../lib/settings/pageIconStore";
import { formatPageIcon } from "../../../../lib/settings/pageIconValue";
import { IconCell, type CellHandlers } from "./IconCell";
import { useGridKeys } from "./useGridKeys";

type ImageLibraryProps = CellHandlers & { images: readonly PageIconImage[]; glyph: (value: string) => PanelIconComponent; onDelete: (id: string) => void };

export function ImageLibrary({ images, glyph, onDelete, ...cell }: ImageLibraryProps) {
  const text = useTranslation().settings.islandPages.icons.picker.image;
  const onKeys = useGridKeys();
  if (images.length === 0) return null;
  return (
    <>
      <div className="page-icon-section">
        <span>{text.library}</span>
        <span>{text.libraryHint}</span>
      </div>
      <div className="page-icon-grid page-icon-library" role="radiogroup" aria-label={text.library} onKeyDown={onKeys}>
        {images.map((image) => {
          const value = formatPageIcon({ kind: "image", id: image.id });
          return (
            <div key={image.id} className="page-icon-library__item">
              <IconCell value={value} label={text.mine} icon={glyph(value)} {...cell} />
              <button className="page-icon-library__remove" type="button" aria-label={text.remove} title={text.remove} onClick={() => onDelete(image.id)}>
                <X size={11} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
