import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "../../../i18n";
import { gridWidthPx, type CustomPanel } from "../../../lib/settings/customPanels";
import { PreviewPanel } from "./PreviewPanel";
import type { IslandPageRow } from "./useIslandPageRows";
import type { WidgetLibrary } from "./useWidgetLibrary";

const ISLAND_PADDING = 14;
const ISLAND_WIDTH = gridWidthPx + ISLAND_PADDING * 2;

function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setScale(Math.min(1, element.clientWidth / ISLAND_WIDTH) || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, scale };
}

type ExpandedPreviewProps = {
  rows: readonly IslandPageRow[];
  current: IslandPageRow | undefined;
  panel: CustomPanel | undefined;
  library: WidgetLibrary;
  selected: string | undefined;
  onPage: (id: string) => void;
  onWidget: (id: string) => void;
  onPanel: (panel: CustomPanel) => void;
};

export function ExpandedPreview({ rows, current, panel, library, selected, onPage, onWidget, onPanel }: ExpandedPreviewProps) {
  const text = useTranslation().settings.islandPages;
  const { ref, scale } = useFitScale();
  const tabs = rows.filter((row) => !row.hidden && !row.off);
  const CurrentIcon = current?.icon;
  return (
    <div className="expanded-preview" ref={ref}>
      <div className="expanded-preview__island" style={{ width: ISLAND_WIDTH, zoom: scale }}>
        <div className="expanded-preview__head">
          {tabs.map((row) => {
            const Icon = row.icon;
            const on = row.id === current?.id;
            return (
              <button key={row.id} className="expanded-preview__tab" type="button" data-page={row.id} aria-pressed={on} aria-label={row.name} title={row.name} onClick={() => onPage(row.id)}>
                <Icon size={13} strokeWidth={2} aria-hidden="true" />
                {on ? <span>{row.name}</span> : null}
              </button>
            );
          })}
        </div>
        {panel ? (
          <PreviewPanel panel={panel} library={library} selected={selected} scale={scale} onWidget={onWidget} onChange={onPanel} />
        ) : current && CurrentIcon ? (
          <div className="expanded-preview__page" data-page={current.id}>
            <CurrentIcon size={24} strokeWidth={1.6} aria-hidden="true" />
            <strong>{current.name}</strong>
            <span>{current.off ? text.preview.off : text.preview.builtin}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
