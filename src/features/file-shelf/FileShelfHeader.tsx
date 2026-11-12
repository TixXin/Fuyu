import { useEffect, useState } from "react";
import { Copy, Search, Trash2, X } from "lucide-react";
import { RowMenu } from "../../components/list/RowMenu";
import { useTranslation } from "../../i18n";

const CLEAR_CONFIRM_MS = 3_000;

export type ShelfView = "all" | "pinned";

export function FileShelfHeader({
  view,
  count,
  noticeKey,
  query,
  selectedCount,
  onViewChange,
  onQueryChange,
  onClear,
  onCopySelected,
  onRemoveSelected,
  onClearSelection,
}: {
  view: ShelfView;
  count: number;
  noticeKey: number | null;
  query: string;
  selectedCount: number;
  onViewChange: (view: ShelfView) => void;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onCopySelected: () => void;
  onRemoveSelected: () => void;
  onClearSelection: () => void;
}) {
  const t = useTranslation();
  const text = t.fileShelf;
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (!confirmingClear) return;
    const timer = window.setTimeout(() => setConfirmingClear(false), CLEAR_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  const views: [ShelfView, string][] = [["all", text.all], ["pinned", text.pinned]];
  return (
    <>
      <header className="island-list-bar">
        <div className="island-list-chips" role="group" aria-label={text.title}>
          {views.map(([key, label]) => (
            <button key={key} className="island-list-chip" type="button" aria-pressed={view === key} onClick={() => onViewChange(key)}>
              {label}
            </button>
          ))}
        </div>
        {noticeKey !== null && (
          <em key={noticeKey} className="island-list-notice" role="status">{text.alreadyOnShelf}</em>
        )}
        <span className="island-list-count">{count}</span>
        <RowMenu
          label={t.common.more}
          items={[
            {
              key: "clear",
              label: confirmingClear ? text.confirmClear : text.clear,
              icon: <Trash2 size={14} strokeWidth={2} />,
              danger: true,
              disabled: count === 0,
              keepOpen: !confirmingClear,
              onSelect: () => {
                if (confirmingClear) {
                  setConfirmingClear(false);
                  onClear();
                } else {
                  setConfirmingClear(true);
                }
              },
            },
          ]}
        />
      </header>
      <label className="island-list-search">
        <Search size={15} strokeWidth={2.1} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder={text.searchPlaceholder}
          aria-label={text.searchLabel}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.stopPropagation();
              onQueryChange("");
            }
          }}
        />
        {query && (
          <button type="button" aria-label={text.clearSearch} onClick={() => onQueryChange("")}>
            <X size={14} strokeWidth={2.4} />
          </button>
        )}
      </label>
      {selectedCount > 1 && (
        <div className="shelf-selection-bar" role="toolbar" aria-label={text.selectedCount(selectedCount)}>
          <span>{text.selectedCount(selectedCount)}</span>
          <button type="button" aria-label={text.copySelected} onClick={onCopySelected}>
            <Copy size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.copy}
          </button>
          <button type="button" aria-label={text.removeSelected} onClick={onRemoveSelected}>
            <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.remove}
          </button>
          <button type="button" aria-label={text.clearSelection} onClick={onClearSelection}>
            <X size={13} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </>
  );
}
