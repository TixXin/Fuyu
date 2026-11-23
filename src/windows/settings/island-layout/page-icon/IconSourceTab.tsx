import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { PanelIconComponent } from "../../../../components/island-widget/panelIcons";
import { loadLucideCatalog, lucideCatalogNow, searchIcons, type LucideCatalog } from "../../../../components/page-icons/lucideCatalog";
import { useTranslation } from "../../../../i18n";
import { IconCell, type CellHandlers } from "./IconCell";
import type { PageIconSource } from "./pageIconSources";
import { useGridKeys } from "./useGridKeys";

const PAGE = 240;
const NO_NAMES: readonly string[] = [];

type Lead = { value: string; label: string; wide?: boolean; caption?: string };

type IconSourceTabProps = CellHandlers & {
  lead: readonly Lead[];
  recent: readonly string[];
  recommended: readonly string[];
  glyph: (value: string) => PanelIconComponent;
  label: (value: string) => string;
  onSource: (source: PageIconSource) => void;
};

function useCatalog() {
  const [catalog, setCatalog] = useState<LucideCatalog | null>(lucideCatalogNow);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (catalog) return;
    let live = true;
    loadLucideCatalog().then((loaded) => live && setCatalog(loaded)).catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [catalog]);
  return { catalog, failed };
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function IconSourceTab({ lead, recent, recommended, glyph, label, onSource, ...cell }: IconSourceTabProps) {
  const text = useTranslation().settings.islandPages.icons.picker;
  const { catalog, failed } = useCatalog();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const onKeys = useGridKeys();
  const names = catalog?.names ?? NO_NAMES;
  const results = useMemo(() => (query.trim() ? searchIcons(names, query) : names), [names, query]);
  const list = results.slice(0, shown);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    const more = moreRef.current;
    if (!more || shown >= results.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setShown((count) => count + PAGE);
    }, { root: scrollRef.current, rootMargin: "120px" });
    observer.observe(more);
    return () => observer.disconnect();
  }, [shown, results.length]);

  const cells = (values: readonly string[]) => values.map((value) => <IconCell key={value} value={value} label={label(value)} icon={glyph(value)} {...cell} />);
  const searching = query.trim() !== "";

  return (
    <div className="page-icon-tab" onKeyDown={onKeys}>
      <label className="page-icon-search">
        <Search size={15} strokeWidth={1.8} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={text.search.placeholder(names.length || 1700)}
          aria-label={text.search.label}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setShown(PAGE);
            scrollRef.current?.scrollTo({ top: 0 });
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              setQuery("");
            }
            if (event.key === "ArrowDown") {
              const first = event.currentTarget.closest(".page-icon-tab")?.querySelector<HTMLElement>("[data-icon-cell]");
              if (first) {
                event.preventDefault();
                first.tabIndex = 0;
                first.focus();
              }
            }
          }}
        />
        <kbd aria-hidden="true">/</kbd>
      </label>
      {searching ? null : (
        <>
          {recent.length > 0 ? (
            <>
              <div className="page-icon-section">{text.sections.recent}</div>
              <div className="page-icon-grid" role="radiogroup" aria-label={text.sections.recent}>{cells(recent)}</div>
            </>
          ) : null}
          <div className="page-icon-section">{text.sections.recommended}</div>
          <div className="page-icon-grid" role="radiogroup" aria-label={text.sections.recommended}>
            {lead.map((item) => <IconCell key={item.value || "default"} value={item.value} label={item.label} icon={glyph(item.value)} wide={item.wide} caption={item.caption} {...cell} />)}
            {cells(recommended)}
          </div>
        </>
      )}
      <div className="page-icon-section">
        <span>{searching ? text.search.results(results.length) : text.sections.all(names.length)}</span>
        {results.length > shown ? <span>{text.sections.more}</span> : null}
      </div>
      {failed ? <p className="page-icon-note">{text.search.failed}</p>
        : !catalog ? <p className="page-icon-note" aria-live="polite">{text.search.loading}</p>
        : searching && results.length === 0 ? (
          <div className="page-icon-empty">
            <p>{text.search.empty(query.trim())}</p>
            <div>
              <button type="button" onClick={() => onSource("emoji")}>{text.search.useEmoji}</button>
              <button type="button" onClick={() => onSource("text")}>{text.search.useText}</button>
              <button type="button" onClick={() => onSource("image")}>{text.search.useImage}</button>
            </div>
          </div>
        ) : (
          <div className="page-icon-scroll" ref={scrollRef}>
            <div className="page-icon-grid" role="radiogroup" aria-label={text.search.label}>{cells(list)}</div>
            <div ref={moreRef} className="page-icon-more" aria-hidden="true" />
          </div>
        )}
    </div>
  );
}
