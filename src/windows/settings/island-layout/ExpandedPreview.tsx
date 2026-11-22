import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "../../../i18n";
import { FUYU_PAGE_ID, type CustomPanel } from "../../../lib/settings/customPanels";
import type { IslandSettings } from "../../../lib/settings/types";
import { stripRoom } from "../../island/custom-panels/panelSize";
import { islandPageSize } from "../../island/pageSize";
import { useIslandNotchShown } from "../useIslandNotchShown";
import { PreviewHeader } from "./PreviewHeader";
import { PreviewPanel } from "./PreviewPanel";
import type { IslandPageRow } from "./useIslandPageRows";
import type { WidgetLibrary } from "./useWidgetLibrary";
import "./ExpandedPreview.css";

function useStageWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth || null);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

type ExpandedPreviewProps = {
  settings: IslandSettings;
  rows: readonly IslandPageRow[];
  current: IslandPageRow | undefined;
  screenshotOn: boolean;
  panel: CustomPanel | undefined;
  library: WidgetLibrary;
  selected: string | undefined;
  onPage: (id: string) => void;
  onWidget: (id: string) => void;
  onPanel: (panel: CustomPanel) => void;
};

export function ExpandedPreview({ settings, rows, current, screenshotOn, panel, library, selected, onPage, onWidget, onPanel }: ExpandedPreviewProps) {
  const text = useTranslation().settings.islandPages;
  const notch = useIslandNotchShown();
  const { ref, width: stageWidth } = useStageWidth();
  const size = islandPageSize(settings, current?.id ?? FUYU_PAGE_ID);
  const zoom = stageWidth ? Math.min(1, stageWidth / size.width) : 1;
  const room = stripRoom(size);
  const CurrentIcon = current?.icon;
  return (
    <div className="expanded-preview" ref={ref}>
      <div className="expanded-preview__island" data-page={current?.id} style={{ width: size.width, height: size.height, zoom }}>
        <PreviewHeader rows={rows} current={current} notch={notch} showTitle={settings.showTitle} screenshot={screenshotOn} onPage={onPage} />
        <div className="expanded-preview__body">
          {panel ? (
            <PreviewPanel panel={panel} room={room} zoom={zoom} library={library} selected={selected} onWidget={onWidget} onChange={onPanel} />
          ) : current && CurrentIcon ? (
            <div className="expanded-preview__page" data-page={current.id}>
              <CurrentIcon size={24} strokeWidth={1.6} aria-hidden="true" />
              <strong>{current.name}</strong>
              <span>{current.off ? text.preview.off : text.preview.builtin}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
