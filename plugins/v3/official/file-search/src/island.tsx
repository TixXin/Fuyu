import type { Context } from "@fuyu/plugin-base";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ClockIcon, CloseIcon, FileSearchIcon, FolderIcon, SearchIcon, SettingsIcon } from "./icons.tsx";
import { islandApi } from "./island-api.ts";
import { METHODS, extensionOf, fileKindOf, shortenFolder, type FileHit } from "./model.ts";
import { Notice } from "./notice.tsx";
import { PAGE_TITLE, text } from "./text.ts";
import { useFileSearch, useFileSearchState } from "./useFileSearch.ts";
import "./styles.css";

function isMacLike(): boolean {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent || "");
}

type SettingsOpener = { settings?: { open?: () => unknown } };

function settingsOpener(ctx: Context): (() => unknown) | null {
  const holder = (ctx as unknown as SettingsOpener).settings;
  const open = holder?.open;
  return typeof open === "function" ? () => open.call(holder) : null;
}

function HighlightName({ name, query }: { name: string; query: string }) {
  const clean = query.trim();
  if (!clean) return <>{name}</>;
  const lower = name.toLowerCase();
  const needle = clean.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="fuyu-file-search__mark">{name.slice(idx, idx + needle.length)}</mark>
      {name.slice(idx + needle.length)}
    </>
  );
}

interface PageProps {
  mode?: string;
}

export default function apply(ctx: Context) {
  const openSettings = settingsOpener(ctx);

  function FileSearchPage(props?: PageProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
    const restoredRef = useRef(false);
    const { state } = useFileSearchState(ctx);
    const scopeKey = `${state.settings.resultLimit}:${state.settings.macScope}`;
    const { result, loading, error, retry, call } = useFileSearch(ctx, query, scopeKey);
    const isExpanded = !props?.mode || props.mode === "expanded";
    const mac = isMacLike();
    const searching = query.trim().length > 0;
    const recentHits = state.settings.showRecent ? state.recent : [];
    const hits: FileHit[] = searching ? (result?.status === "ok" ? result.hits : []) : recentHits;
    const activeIndex = hits.length === 0 ? -1 : Math.max(0, Math.min(selectedIndex, hits.length - 1));

    useEffect(() => {
      if (restoredRef.current) return;
      restoredRef.current = true;
      let alive = true;
      ctx.host.call<string>(METHODS.lastQuery).then(
        (previous) => {
          if (!alive || typeof previous !== "string" || !previous) return;
          setQuery((current) => current || previous);
          inputRef.current?.select();
        },
        () => undefined,
      );
      return () => {
        alive = false;
      };
    }, []);

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

    const act = async (hit: FileHit, reveal: boolean) => {
      const ok = await call(reveal ? METHODS.reveal : METHODS.open, { path: hit.path });
      if (!ok || !state.settings.autoCollapse) return;
      const collapse = islandApi(ctx)?.collapse;
      try {
        if (collapse) await collapse();
      } catch {
        return;
      }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (hits.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setSelectedIndex((activeIndex + step + hits.length) % hits.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const target = activeIndex >= 0 ? hits[activeIndex] : undefined;
        if (target) void act(target, event.ctrlKey || event.metaKey);
        return;
      }
      if (event.key === "Escape" && query.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        setQuery("");
        setSelectedIndex(0);
      }
    };

    const toggleQuick = (q: string) => {
      setQuery((prev) => (prev.trim().toLowerCase() === q.toLowerCase() ? "" : q));
      setSelectedIndex(0);
      inputRef.current?.focus();
    };

    const revealLabel = mac ? text.revealMac : text.reveal;
    const renderList = (items: readonly FileHit[], highlightQuery: string) => (
      <ul className="fuyu-file-search__list" role="listbox" aria-label={text.title}>
        {items.map((hit, index) => {
          const selected = index === activeIndex;
          const ext = hit.isDir ? "" : extensionOf(hit.name);
          const kind = fileKindOf(hit);
          const folder = shortenFolder(hit.folder, state.homeDir);
          return (
            <li
              key={hit.path}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              role="option"
              aria-selected={selected}
              className={selected ? "fuyu-file-search__row is-active" : "fuyu-file-search__row"}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <button type="button" className="fuyu-file-search__item" title={hit.path} onClick={() => void act(hit, false)}>
                <span className={`fuyu-file-search__badge is-${kind}`} aria-hidden="true">
                  {ext || <FolderIcon size={13} />}
                </span>
                <span className="fuyu-file-search__main">
                  <span className="fuyu-file-search__name">
                    <HighlightName name={hit.name} query={highlightQuery} />
                  </span>
                  {folder && <span className="fuyu-file-search__folder">{folder}</span>}
                </span>
              </button>
              <button
                type="button"
                className="fuyu-file-search__reveal"
                aria-label={revealLabel}
                title={revealLabel}
                onClick={() => void act(hit, true)}
              >
                <FolderIcon size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    );

    let body: ReactNode;
    if (!searching) {
      if (recentHits.length > 0) {
        body = (
          <div className="fuyu-file-search__section">
            <div className="fuyu-file-search__section-head">
              <span className="fuyu-file-search__section-title">
                <ClockIcon size={12} />
                <span>{text.recentTitle}</span>
              </span>
              <span className="fuyu-file-search__count">{recentHits.length}</span>
            </div>
            {renderList(recentHits, "")}
          </div>
        );
      } else {
        body = <p className="fuyu-file-search__empty">{mac ? text.typeToSearchMac : text.typeToSearch}</p>;
      }
    } else if (!result) {
      body = <p className="fuyu-file-search__empty">{text.searching}</p>;
    } else if (result.status !== "ok") {
      body = (
        <Notice
          result={result}
          onRetry={retry}
          onDownload={() => void call(METHODS.openDownload)}
          onStart={() => call(METHODS.startEverything)}
        />
      );
    } else if (hits.length === 0) {
      body = <p className="fuyu-file-search__empty">{loading ? text.searching : text.noResults}</p>;
    } else {
      body = (
        <>
          {renderList(hits, query)}
          {result.truncated && <p className="fuyu-file-search__muted">{text.more(state.settings.resultLimit)}</p>}
        </>
      );
    }

    return (
      <div className="fuyu-file-search">
        <div className="fuyu-file-search__bar">
          <div className="fuyu-file-search__input-wrap">
            <span className="fuyu-file-search__lead-icon" aria-hidden="true">
              <SearchIcon size={14} />
            </span>
            <input
              ref={inputRef}
              type="text"
              autoFocus
              className="fuyu-file-search__input"
              value={query}
              placeholder={text.placeholder}
              aria-label={text.placeholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={onKeyDown}
            />
            {query.length > 0 && (
              <button
                type="button"
                className="fuyu-file-search__clear"
                aria-label={text.clearSearch}
                title={text.clearSearch}
                onClick={() => {
                  setQuery("");
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
              >
                <CloseIcon size={11} />
              </button>
            )}
          </div>
          {openSettings && (
            <button
              type="button"
              className="fuyu-file-search__settings-btn"
              title={text.settingsTip}
              aria-label={text.settingsTip}
              onClick={() => void openSettings()}
            >
              <SettingsIcon size={14} />
            </button>
          )}
        </div>

        <div className="fuyu-file-search__filters">
          {text.quickFilters.map((chip) => {
            const active = query.trim().toLowerCase() === chip.query;
            return (
              <button
                key={chip.query}
                type="button"
                className={active ? `fuyu-file-search__filter is-${chip.kind} is-on` : `fuyu-file-search__filter is-${chip.kind}`}
                onClick={() => toggleQuick(chip.query)}
              >
                <span className="fuyu-file-search__filter-dot" aria-hidden="true" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {body}

        {hits.length > 0 && (
          <div className="fuyu-file-search__foot">
            <span className="fuyu-file-search__hints">
              <span className="fuyu-file-search__hint">
                <kbd>↵</kbd>
                {text.keyOpen}
              </span>
              <span className="fuyu-file-search__hint">
                <kbd>{mac ? "⌘↵" : "Ctrl↵"}</kbd>
                {mac ? text.keyRevealMac : text.keyReveal}
              </span>
              <span className="fuyu-file-search__hint">
                <kbd>↑↓</kbd>
                {text.keyMove}
              </span>
            </span>
            {searching && result && (
              <span className="fuyu-file-search__count">{text.countLabel(hits.length, result.truncated)}</span>
            )}
          </div>
        )}

        {error && <p className="fuyu-file-search__muted">{error}</p>}
      </div>
    );
  }

  ctx.slots.add("island.page/v1", {
    id: "@fuyu/file-search",
    title: PAGE_TITLE,
    component: FileSearchPage,
    icon: FileSearchIcon,
  });
}
