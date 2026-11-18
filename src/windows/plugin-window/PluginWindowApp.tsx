import { useCallback, useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Blocks, X } from "lucide-react";
import { pluginRuntime } from "../../features/plugin-kernel/runtime";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { defineSlot, type PluginWindowViewMeta, type SlotEntry } from "../../features/plugin-kernel/slots";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useTranslation } from "../../i18n";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
import { useWindowLight } from "../../lib/theme/useWindowLight";
import "./PluginWindowApp.css";

type WindowKind = "overlay" | "widget";

const pluginWindowSlot = defineSlot<Record<string, unknown>, PluginWindowViewMeta>("plugin-window.view/v1");

function findViewEntry<P extends object>(
  entries: readonly SlotEntry<P, PluginWindowViewMeta>[],
  plugin: string,
  windowId: string,
): SlotEntry<P, PluginWindowViewMeta> | undefined {
  if (!plugin) return undefined;
  if (!windowId) return entries.find((entry) => entry.owner === plugin);
  return (
    entries.find(
      (entry) =>
        entry.owner === plugin &&
        (entry.windowId === windowId || entry.id === windowId || entry.id === `${plugin}:${windowId}`),
    ) ?? entries.find((entry) => entry.owner === plugin && entry.windowId === undefined && entry.id === "default")
  );
}

export function PluginWindowApp() {
  const t = useTranslation();
  useWindowAccent();
  const light = useWindowLight();

  const query = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const plugin = params.get("plugin")?.trim() ?? "";
    const windowId = params.get("windowId")?.trim() ?? "";
    const kind: WindowKind = params.get("kind")?.trim() === "widget" ? "widget" : "overlay";
    const title = params.get("title")?.trim() ?? "";
    return { plugin, windowId, kind, title };
  }, []);

  useEffect(() => {
    void pluginRuntime("plugin-window");
  }, []);

  const closeWindow = useCallback(() => {
    void getCurrentWindow().close().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (query.kind === "widget") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeWindow();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [query.kind, closeWindow]);

  const entries = useSlotEntries(pluginWindowSlot);
  const matched = findViewEntry(entries, query.plugin, query.windowId);
  const baseTitle = query.title || matched?.title || query.windowId;
  const resolvedTitle = baseTitle || query.plugin;
  const headerLabel = baseTitle && query.plugin ? `${baseTitle} · ${query.plugin}` : resolvedTitle;
  const selectEntry = useCallback(
    (items: readonly SlotEntry<Record<string, unknown>, PluginWindowViewMeta>[]) => {
      const found = findViewEntry(items, query.plugin, query.windowId);
      return found ? [found] : [];
    },
    [query.plugin, query.windowId],
  );

  return (
    <main className={`plugin-window-stage${light ? " island-light" : ""}`}>
      <div className={`plugin-window plugin-window--${query.kind}`}>
        {query.kind !== "widget" && (
          <header className="plugin-window__header" data-tauri-drag-region>
            <span className="plugin-window__badge" aria-hidden="true">
              <Blocks size={13} strokeWidth={2} />
            </span>
            <span className="plugin-window__title">{headerLabel}</span>
            <button type="button" className="plugin-window__close" aria-label={t.common.close} onClick={closeWindow}>
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </header>
        )}
        <div className="plugin-window__body">
          <div className="plugin-slot">
            <SlotView slot={pluginWindowSlot} props={{ windowId: query.windowId, kind: query.kind, title: resolvedTitle }} select={selectEntry} />
          </div>
        </div>
      </div>
    </main>
  );
}
