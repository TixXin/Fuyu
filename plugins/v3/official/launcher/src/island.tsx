import type { Context } from "@fuyu/plugin-base";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { islandApi } from "./island-api.ts";
import { filterApps, recentApps, sameNameNames, type RankedApp } from "./model.ts";
import { PAGE_TITLE, text } from "./text.ts";
import { useLauncher } from "./useLauncher.ts";
import "./styles.css";

function LauncherIcon({ size = 16, strokeWidth = 2 }: { size?: number | string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="fuyu-launcher__search-icon"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

interface LauncherPageProps {
  mode?: string;
}

export default function apply(ctx: Context) {
  function LauncherPage(props?: LauncherPageProps) {
    const { state, error, launch } = useLauncher(ctx);
    const { settings } = state;
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const isExpanded = !props?.mode || props.mode === "expanded";
    const searching = query.trim().length > 0;
    const showRecent = !searching && settings.emptyView === "recent";

    const visible = useMemo<RankedApp[]>(() => {
      if (searching) return filterApps(state.apps, query);
      if (settings.emptyView === "all") return state.apps;
      return settings.recordRecent ? recentApps(state.apps, settings.recentShown) : [];
    }, [state.apps, query, searching, settings.emptyView, settings.recordRecent, settings.recentShown]);
    const duplicates = useMemo(() => sameNameNames(state.apps), [state.apps]);
    const activeIndex = visible.length === 0 ? -1 : Math.max(0, Math.min(selectedIndex, visible.length - 1));

    useEffect(() => {
      if (!isExpanded) return;
      inputRef.current?.focus();
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
        return () => window.cancelAnimationFrame(frame);
      }
      return undefined;
    }, [isExpanded]);

    useEffect(() => {
      if (activeIndex < 0) return;
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    const reset = () => {
      setQuery("");
      setSelectedIndex(0);
    };

    const open = async (app: RankedApp) => {
      const next = await launch(app.path);
      if (!next) return;
      reset();
      if (next.settings.autoCollapse) {
        const collapse = islandApi(ctx)?.collapse;
        try {
          if (collapse) await collapse();
        } catch {
          return;
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (visible.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setSelectedIndex((activeIndex + step + visible.length) % visible.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const target = activeIndex >= 0 ? visible[activeIndex] : undefined;
        if (target) void open(target);
        return;
      }
      if (event.key === "Escape" && query.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        reset();
      }
    };

    let empty: string | null = null;
    if (visible.length === 0) {
      if (state.scannedAt > 0 && state.totalCount === 0) empty = text.emptyApps;
      else empty = searching ? text.emptySearch : text.typeToSearch;
    }

    return (
      <div className="fuyu-launcher">
        <div className="fuyu-launcher__input-wrap">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            className="fuyu-launcher__input"
            value={query}
            placeholder={text.searchPlaceholder}
            aria-label={text.searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="fuyu-launcher__clear-btn"
              aria-label={text.clearSearch}
              title={text.clearSearch}
              onClick={() => {
                reset();
                inputRef.current?.focus();
              }}
            >
              ×
            </button>
          )}
        </div>

        {empty ? (
          <p className="fuyu-launcher__empty">{empty}</p>
        ) : (
          <>
            {showRecent && <p className="fuyu-launcher__heading">{text.recentHeading}</p>}
            <ul className="fuyu-launcher__list" role="listbox" aria-label={text.title}>
              {visible.map((app, index) => {
                const selected = index === activeIndex;
                const initial = (app.name.trim()[0] ?? "•").toUpperCase();
                const folder = app.folder && (settings.showFolder || duplicates.has(app.name.toLowerCase())) ? app.folder : "";
                return (
                  <li key={app.id} role="option" aria-selected={selected}>
                    <button
                      ref={(node) => {
                        itemRefs.current[index] = node;
                      }}
                      type="button"
                      className={selected ? "fuyu-launcher__item fuyu-launcher__item--active" : "fuyu-launcher__item"}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => void open(app)}
                    >
                      <span className="fuyu-launcher__avatar" aria-hidden="true">
                        {initial}
                      </span>
                      <span className="fuyu-launcher__main">
                        <span className="fuyu-launcher__name">{app.name}</span>
                        {folder && <span className="fuyu-launcher__folder">{folder}</span>}
                      </span>
                      {settings.showCount && app.count > 0 && (
                        <span className="fuyu-launcher__badge">{text.launchCount(app.count)}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {error && <p className="fuyu-launcher__note">{error}</p>}
      </div>
    );
  }

  ctx.slots.add("island.page/v1", {
    id: "@fuyu/launcher",
    title: PAGE_TITLE,
    component: LauncherPage,
    icon: LauncherIcon,
  });
}
