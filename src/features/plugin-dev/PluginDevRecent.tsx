import { FolderInput, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { PluginDevPlugin } from "./api";

export function PluginDevRecent({
  plugins,
  restores,
  busy,
  onLoad,
  onForget,
}: {
  plugins: PluginDevPlugin[];
  restores: boolean;
  busy: boolean;
  onLoad: (path: string) => void;
  onForget: (path: string) => void;
}) {
  const text = useTranslation().settings.plugins.dev;
  if (plugins.length === 0 && !restores) return null;
  return (
    <div className="plugin-dev__recent">
      <strong>{text.recent}</strong>
      {restores ? <p className="settings-section__hint">{text.recentRestores}</p> : null}
      {plugins.length ? (
        <ul className="plugin-dev__plugins">
          {plugins.map((plugin) => (
            <li key={plugin.path}>
              <div className="plugin-dev__pick plugin-dev__pick--static">
                <strong>{plugin.id}</strong>
                <span>{plugin.path}</span>
              </div>
              <button className="plugin-card__button" type="button" disabled={busy} onClick={() => onLoad(plugin.path)}>
                <FolderInput size={12} strokeWidth={2.4} />
                <span>{text.loadAgain}</span>
              </button>
              <button className="plugin-card__button" type="button" disabled={busy} onClick={() => onForget(plugin.path)}>
                <X size={12} strokeWidth={2.4} />
                <span>{text.forget}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
