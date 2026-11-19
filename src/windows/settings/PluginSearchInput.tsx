import { Search, X } from "lucide-react";

export function PluginSearchInput({ query, placeholder, clearLabel, onChange }: {
  query: string;
  placeholder: string;
  clearLabel: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="plugin-search">
      <Search size={13} strokeWidth={2.2} aria-hidden="true" />
      <input
        type="search"
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query) {
            event.preventDefault();
            onChange("");
          }
        }}
      />
      {query ? (
        <button className="plugin-search__clear" type="button" aria-label={clearLabel} title={clearLabel} onClick={() => onChange("")}>
          <X size={12} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}
