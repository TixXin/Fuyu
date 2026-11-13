import { Search } from "lucide-react";
import { useTranslation } from "../../i18n";
import "./PluginToolbar.css";

export function InstalledPluginsToolbar({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const text = useTranslation().settings.plugins.overview;

  return (
    <div className="plugins-toolbar">
      <label className="plugin-search">
        <Search size={13} strokeWidth={2.4} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder={text.search}
          aria-label={text.search}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={(event) => event.key === "Escape" && query && (event.preventDefault(), onQueryChange(""))}
        />
      </label>
    </div>
  );
}
