import { Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "../../../../i18n";
import { usePagerView, type PagerBlock, type PagerPlacement } from "./pagerStore";
import "./PanelPager.css";

const blockStyle = (block: PagerBlock): CSSProperties => ({
  left: `${block.left * 100}%`,
  top: `${block.top * 100}%`,
  width: `calc(${block.width * 100}% - 2px)`,
  height: `calc(${block.height * 100}% - 2px)`,
});

export function PanelPager({ placement }: { placement: PagerPlacement }) {
  const t = useTranslation().islandWidgets.panel.paging;
  const view = usePagerView();
  if (!view || view.placement !== placement) return null;
  const { pages, page, hot } = view;
  if (!view.dragging) {
    if (pages.length < 2) return null;
    return (
      <div className="panel-pager" role="group" aria-label={t.pages} data-placement={placement}>
        {pages.map((_, index) => (
          <button
            key={index}
            type="button"
            className="panel-pager__dot"
            aria-label={t.goTo(index + 1)}
            aria-current={index === page ? "page" : undefined}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              view.onPick(index);
            }}
          />
        ))}
      </div>
    );
  }
  const progress = (kind: "page" | "all", index: number) => (hot && hot.kind === kind && hot.index === index ? hot.progress : 0);
  return (
    <div className="panel-pager panel-pager--thumbs" data-placement={placement} aria-hidden="true">
      {pages.map((blocks, index) => (
        <div key={index} className="panel-pager__thumb" data-panel-drop="page" data-index={index} data-current={index === page || undefined} data-hot={progress("page", index) > 0 || undefined}>
          <span className="panel-pager__sheet">
            {blocks.map((block) => (
              <i key={block.widget} className="panel-pager__block" data-tone={block.tone} style={blockStyle(block)} />
            ))}
          </span>
          <span className="panel-pager__bar" style={{ transform: `scaleX(${progress("page", index)})` }} />
        </div>
      ))}
      {view.canAdd ? (
        <div className="panel-pager__thumb panel-pager__new" data-panel-drop="new" data-index={pages.length} title={t.newPage}>
          <Plus size={13} strokeWidth={2.2} />
        </div>
      ) : null}
      <div className="panel-pager__all" data-panel-drop="all" data-index={0} data-hot={progress("all", 0) > 0 || undefined} data-open={view.overview || undefined}>
        {t.all}
        <span className="panel-pager__bar" style={{ transform: `scaleX(${progress("all", 0)})` }} />
      </div>
    </div>
  );
}
