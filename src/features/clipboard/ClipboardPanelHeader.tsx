import { Trash2 } from "lucide-react";
import { RowMenu } from "../../components/list/RowMenu";
import { useTranslation } from "../../i18n";
import type { ClipboardView } from "./useClipboardHistoryList";

/** The filters (all, starred, images, files and the most used #tags), the count and "⋯". */
export function ClipboardPanelHeader({
  view,
  query,
  tags,
  itemCount,
  isConfirmingClear,
  onViewChange,
  onTag,
  onClear,
}: {
  view: ClipboardView;
  query: string;
  tags: string[];
  itemCount: number;
  isConfirmingClear: boolean;
  onViewChange: (view: ClipboardView) => void;
  onTag: (tag: string) => void;
  onClear: () => void;
}) {
  const t = useTranslation();
  const text = t.clipboard;
  const views: [ClipboardView, string][] = [["all", text.all], ["favorites", text.favorites], ["images", text.images], ["files", text.files]];
  const tagQuery = query.trim().toLowerCase();

  return (
    <header className="island-list-bar">
      <div className="island-list-chips" role="group" aria-label={text.segments}>
        {views.map(([key, label]) => (
          <button key={key} className="island-list-chip" type="button" aria-pressed={view === key && !tagQuery.startsWith("#")} onClick={() => onViewChange(key)}>
            {label}
          </button>
        ))}
        {tags.map((tag) => (
          <button key={tag} className="island-list-chip island-list-chip--tag" type="button" aria-label={text.filterByTag(tag)} aria-pressed={tagQuery === `#${tag.toLowerCase()}`} onClick={() => onTag(tag)}>
            #{tag}
          </button>
        ))}
      </div>
      <span className="island-list-count">{itemCount}</span>
      <RowMenu
        label={t.common.more}
        items={[
          {
            key: "clear",
            label: isConfirmingClear ? text.confirmClear : text.clearHistory,
            icon: <Trash2 size={14} strokeWidth={2} />,
            danger: true,
            disabled: itemCount === 0,
            keepOpen: !isConfirmingClear,
            onSelect: onClear,
          },
        ]}
      />
    </header>
  );
}
