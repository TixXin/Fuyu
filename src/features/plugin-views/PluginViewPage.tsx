import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { restartPlugin, type PluginViewEntry } from "./api";
import { viewIcon } from "./icons";
import { DetailTemplate } from "./templates/DetailTemplate";
import { FormTemplate } from "./templates/FormTemplate";
import { ListTemplate } from "./templates/ListTemplate";
import { StatusTemplate } from "./templates/StatusTemplate";
import { WebviewTemplate } from "./templates/WebviewTemplate";
import { usePluginViewModel } from "./usePluginViewModel";
import "./PluginViewPage.css";

export function PluginViewPage({
  entry,
  isOpen,
  onRowsChange,
}: {
  entry: PluginViewEntry;
  isOpen: boolean;
  onRowsChange?: (rows: number) => void;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const running = entry.status === "running";
  const stopped = entry.status === "crashed" || entry.status === "stopped";
  const { model, loaded } = usePluginViewModel(entry.pluginId, entry.viewId, isOpen && !stopped);
  const webview = entry.template === "webview";
  const [restarting, setRestarting] = useState(false);
  const Icon = viewIcon(entry.icon);
  const title = entry.title[locale];
  const pluginName = entry.pluginName[locale];

  const restart = () => {
    setRestarting(true);
    restartPlugin(entry.pluginId)
      .catch((error: unknown) => console.error("Failed to restart a plugin", error))
      .finally(() => setRestarting(false));
  };

  let body;
  if (stopped) {
    body = (
      <div className="plugin-view__state plugin-view__state--stopped" role="status">
        <strong>{t.pluginViews.stopped}</strong>
        {entry.error ? <span>{entry.error}</span> : null}
        <button className="plugin-view__button" type="button" disabled={restarting} onClick={restart}>
          <RotateCcw size={13} strokeWidth={2.4} aria-hidden="true" />
          <span>{t.pluginViews.restart}</span>
        </button>
      </div>
    );
  } else if (!running) {
    body = <p className="plugin-view__state">{t.pluginViews.starting}</p>;
  } else if (webview) {
    body = <WebviewTemplate pluginId={entry.pluginId} viewId={entry.viewId} active={isOpen} frameless={entry.frame === "none"} />;
  } else if (!loaded || model === null) {
    body = <p className="plugin-view__state">{t.pluginViews.waiting}</p>;
  } else if (entry.template === "list") {
    body = <ListTemplate pluginId={entry.pluginId} viewId={entry.viewId} model={model} onRowsChange={onRowsChange} />;
  } else if (entry.template === "detail") {
    body = <DetailTemplate pluginId={entry.pluginId} viewId={entry.viewId} model={model} />;
  } else if (entry.template === "form") {
    body = <FormTemplate pluginId={entry.pluginId} viewId={entry.viewId} model={model} />;
  } else {
    body = <StatusTemplate pluginId={entry.pluginId} viewId={entry.viewId} model={model} />;
  }

  const frameless = webview && running && entry.frame === "none";
  return (
    <section
      className={`plugin-view plugin-view--${entry.template}${frameless ? " plugin-view--frameless" : ""}`}
      aria-label={t.pluginViews.pageLabel(title, pluginName)}
    >
      <header className="plugin-view__title" hidden={frameless}>
        <Icon size={14} strokeWidth={2.3} aria-hidden="true" />
        <strong>{title}</strong>
        <span>{pluginName}</span>
      </header>
      <div className="plugin-view__body">{body}</div>
    </section>
  );
}
