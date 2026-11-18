import type { Context } from "@fuyu/plugin-base";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { TEXT, filterApps } from "./model.ts";
import { useLauncher } from "./useLauncher.ts";
import "./styles.css";

function LauncherIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
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

interface LauncherPageProps {
  mode?: string;
}

export default function apply(ctx: Context) {
  function LauncherPage(props?: LauncherPageProps) {
    const { state, locale, busy, error, launch, rescan } = useLauncher(ctx);
    const copy = TEXT[locale];
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const isExpanded = !props?.mode || props.mode === "expanded";

    const filtered = useMemo(() => filterApps(state.apps, query), [state.apps, query]);
    const activeIndex =
      filtered.length === 0 ? -1 : Math.max(0, Math.min(selectedIndex, filtered.length - 1));

    useEffect(() => {
      if (!isExpanded) return;
      inputRef.current?.focus();
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        const frame = window.requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(frame);
      }
      return undefined;
    }, [isExpanded]);

    useEffect(() => {
      if (activeIndex < 0) return;
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (filtered.length > 0) {
          setSelectedIndex((activeIndex + 1) % filtered.length);
        }
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (filtered.length > 0) {
          setSelectedIndex((activeIndex - 1 + filtered.length) % filtered.length);
        }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const target = activeIndex >= 0 ? filtered[activeIndex] : undefined;
        if (target) {
          void launch(target.path);
        }
        return;
      }
      if (event.key === "Escape" && query.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        setQuery("");
        setSelectedIndex(0);
      }
    };

    return (
      <div className="fuyu-launcher">
        <div className="fuyu-launcher__search-bar">
          <div className="fuyu-launcher__input-wrap">
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
            <input
              ref={inputRef}
              type="text"
              autoFocus
              className="fuyu-launcher__input"
              value={query}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
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
                aria-label={copy.clearSearch}
                title={copy.clearSearch}
                onClick={() => {
                  setQuery("");
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            className="fuyu-launcher__button fuyu-launcher__button--secondary"
            disabled={busy}
            onClick={() => void rescan()}
          >
            {copy.rescanShort}
          </button>
        </div>

        {filtered.length === 0 ? (
          <p className="fuyu-launcher__empty">
            {state.totalCount === 0 ? copy.emptyApps : copy.emptySearch}
          </p>
        ) : (
          <ul className="fuyu-launcher__list" role="listbox" aria-label={copy.title}>
            {filtered.map((app, index) => {
              const selected = index === activeIndex;
              const initial = (app.name.trim()[0] ?? "•").toUpperCase();
              return (
                <li key={app.id} role="option" aria-selected={selected}>
                  <button
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    type="button"
                    className={
                      selected
                        ? "fuyu-launcher__item fuyu-launcher__item--active"
                        : "fuyu-launcher__item"
                    }
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => void launch(app.path)}
                  >
                    <span className="fuyu-launcher__avatar" aria-hidden="true">
                      {initial}
                    </span>
                    <span className="fuyu-launcher__main">
                      <span className="fuyu-launcher__name">{app.name}</span>
                      {app.folder && <span className="fuyu-launcher__folder">{app.folder}</span>}
                    </span>
                    <span className="fuyu-launcher__meta">
                      {app.recent && (
                        <span className="fuyu-launcher__badge">{copy.recentBadge(app.count)}</span>
                      )}
                      {selected && (
                        <span className="fuyu-launcher__enter" aria-hidden="true">
                          ↵
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="fuyu-launcher__footer">
          <span>{copy.footerHint}</span>
          <span>{copy.appCount(filtered.length)}</span>
        </div>

        {error && <p className="fuyu-launcher__note">{error}</p>}
      </div>
    );
  }

  ctx.slots.add("island.page/v1", {
    id: "@fuyu/launcher",
    component: LauncherPage,
    icon: LauncherIcon,
  });
}
