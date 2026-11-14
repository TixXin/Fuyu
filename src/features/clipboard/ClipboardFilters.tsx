import { Search, X } from "lucide-react";
import { useTranslation } from "../../i18n";

export function ClipboardFilters({
  query,
  shortcut,
  onQueryChange,
}: {
  query: string;
  shortcut: string | null;
  onQueryChange: (query: string) => void;
}) {
  const t = useTranslation();

  return (
    <label className="island-list-search">
      <Search size={15} strokeWidth={2.1} aria-hidden="true" />
      <input
        type="search"
        value={query}
        placeholder={t.clipboard.searchPlaceholder}
        aria-label={t.clipboard.searchLabel}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query) {
            event.stopPropagation();
            onQueryChange("");
          }
        }}
      />
      {query ? (
        <button type="button" aria-label={t.clipboard.clearSearch} onClick={() => onQueryChange("")}>
          <X size={14} strokeWidth={2.4} />
        </button>
      ) : shortcut ? (
        <kbd title={t.clipboard.expandShortcut}>{shortcut}</kbd>
      ) : null}
    </label>
  );
}
