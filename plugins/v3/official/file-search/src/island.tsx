import type { Context } from "@fuyu/plugin-base";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { islandApi } from "./island-api.ts";
import { METHODS, RESULT_LIMIT, type FileHit } from "./model.ts";
import { Notice } from "./notice.tsx";
import { PAGE_TITLE, text } from "./text.ts";
import { useFileSearch } from "./useFileSearch.ts";
import "./styles.css";

function FileSearchIcon({ size = 16, strokeWidth = 2 }: { size?: number | string; strokeWidth?: number }) {
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
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <circle cx="11.5" cy="14.5" r="2.5" />
      <path d="M13.3 16.3 15 18" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1, dot + 5).toUpperCase();
}

function isMacLike(): boolean {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent || "");
}

interface PageProps {
  mode?: string;
}

export default function apply(ctx: Context) {
  function FileSearchPage(props?: PageProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
    const { result, loading, error, retry, call } = useFileSearch(ctx, query);
    const isExpanded = !props?.mode || props.mode === "expanded";
    const mac = isMacLike();
    const hits: FileHit[] = result?.status === "ok" ? result.hits : [];
    const activeIndex = hits.length === 0 ? -1 : Math.max(0, Math.min(selectedIndex, hits.length - 1));

    useEffect(() => {
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
      if (!ok) return;
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

    const searching = query.trim().length > 0;
    let body: ReactNode;
    if (!searching) {
      body = <p className="fuyu-file-search__empty">{mac ? text.typeToSearchMac : text.typeToSearch}</p>;
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
      const revealLabel = mac ? text.revealMac : text.reveal;
      body = (
        <>
          <ul className="fuyu-file-search__list" role="listbox" aria-label={text.title}>
            {hits.map((hit, index) => {
              const selected = index === activeIndex;
              const ext = extensionOf(hit.name);
              return (
                <li
                  key={hit.path}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  role="option"
                  aria-selected={selected}
                  className={selected ? "fuyu-file-search__row fuyu-file-search__row--active" : "fuyu-file-search__row"}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <button type="button" className="fuyu-file-search__item" title={hit.path} onClick={() => void act(hit, false)}>
                    <span className="fuyu-file-search__badge" aria-hidden="true">
                      {ext || <FolderIcon />}
                    </span>
                    <span className="fuyu-file-search__main">
                      <span className="fuyu-file-search__name">{hit.name}</span>
                      <span className="fuyu-file-search__folder">{hit.folder}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="fuyu-file-search__reveal"
                    aria-label={revealLabel}
                    title={revealLabel}
                    onClick={() => void act(hit, true)}
                  >
                    <FolderIcon />
                  </button>
                </li>
              );
            })}
          </ul>
          {result.truncated && <p className="fuyu-file-search__muted">{text.more(RESULT_LIMIT)}</p>}
        </>
      );
    }

    return (
      <div className="fuyu-file-search">
        <div className="fuyu-file-search__input-wrap">
          <FileSearchIcon size={14} />
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
              ×
            </button>
          )}
        </div>
        {body}
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
