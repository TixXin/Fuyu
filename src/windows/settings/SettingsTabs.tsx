import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { isMacOS, useUnsupportedFeatures } from "../../lib/platform";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { entryOf, entryTabs, isCategoryAvailable, type SettingsCategory, type TabbedCategory } from "./categories";
import { categorySlot } from "./slots/categorySlot";
import { usePluginsV3Enabled } from "./usePluginHostStatus";
import "./SettingsTabs.css";

export function SettingsTabs({ category, onCategoryChange }: { category: SettingsCategory; onCategoryChange: (category: SettingsCategory) => void }) {
  const text = useTranslation().settings.categories;
  const unsupported = useUnsupportedFeatures();
  const pluginsV3 = usePluginsV3Enabled();
  useSlotEntries(categorySlot);
  const entry = entryOf(category);
  const bar = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const node = bar.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      const box = node.getBoundingClientRect();
      const first = node.firstElementChild?.getBoundingClientRect();
      const last = node.lastElementChild?.getBoundingClientRect();
      const start = first ? first.left < box.left - 1 : false;
      const end = last ? last.right > box.right + 1 : false;
      setEdges((old) => (old.start === start && old.end === end ? old : { start, end }));
    };
    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    measure();
    node.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [entry]);

  useEffect(() => {
    bar.current?.querySelector<HTMLElement>(".settings-tabs__tab--active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [category]);

  if (!entry) return null;
  const tabs = entryTabs(entry).filter((tab) => isCategoryAvailable(tab, unsupported, isMacOS, pluginsV3));
  const move = (from: TabbedCategory, step: number) => {
    const next = tabs[(tabs.indexOf(from) + step + tabs.length) % tabs.length];
    onCategoryChange(next);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.settings-tabs__tab[data-tab='${next}']`)?.focus());
  };
  return (
    <div ref={bar} className="settings-tabs" data-fade-start={edges.start || undefined} data-fade-end={edges.end || undefined} role="tablist" aria-label={text.entries[entry]} data-tauri-drag-region>
      {tabs.map((tab) => {
        const active = tab === category;
        return (
          <button
            key={tab}
            className={`settings-tabs__tab${active ? " settings-tabs__tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-tab={tab}
            onClick={() => onCategoryChange(tab)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") move(tab, 1);
              if (event.key === "ArrowLeft") move(tab, -1);
            }}
          >
            {text.tabs[tab]}
          </button>
        );
      })}
    </div>
  );
}
