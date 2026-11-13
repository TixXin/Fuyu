import { useEffect, useRef, useState } from "react";
import { Bell, Blocks, Brush, Bot, CalendarDays, ChevronRight, Compass, Plus, ClipboardList, Crop, Inbox, Info, Keyboard, Languages, LayoutGrid, LayoutTemplate, ListTodo, MousePointerClick, MessageCircle, MessagesSquare, Music, PanelTop, Palette, Plug, Puzzle, Search, Server, Settings2, ShieldCheck, Store, SlidersHorizontal, Volume2, X, type LucideIcon } from "lucide-react";
import { LOCALE_CODES, useLocale, useTranslation } from "../../i18n";
import { useUnsupportedFeatures } from "../../lib/platform";
import { isCategoryAvailable, SETTINGS_GROUPS, searchCategories, type SettingsCategory, type SettingsGroup } from "./categories";
import searchIndex from "./searchIndex.json";
import { isTitleHit, MAX_HITS_PER_PAGE, searchSettingsRows, type SettingsRowHit, type SettingsSearchEntry } from "./settingsSearch";
import "./SettingsSidebar.css";

export const CATEGORY_ICONS: Record<SettingsCategory, LucideIcon> = {
  overview: Compass,
  general: SlidersHorizontal,
  behavior: MousePointerClick,
  appearance: LayoutTemplate,
  theme: Palette,
  themeMarket: Brush,
  shortcuts: Keyboard,
  messages: MessageCircle,
  todos: ListTodo,
  calendar: CalendarDays,
  music: Music,
  clipboard: ClipboardList,
  translation: Languages,
  shelf: Inbox,
  screenshot: Crop,
  agents: PanelTop,
  agentSessions: MessagesSquare,
  agentRemote: Server,
  agentAlerts: Bell,
  sounds: Volume2,
  agentApprovals: ShieldCheck,
  agentConnect: Plug,
  plugins: Puzzle,
  market: Store,
  about: Info,
};

const SEARCH_ENTRIES = searchIndex.entries as SettingsSearchEntry[];

const GROUP_ICONS: Record<SettingsGroup, LucideIcon> = {
  basics: Settings2,
  features: LayoutGrid,
  agents: Bot,
  extensions: Blocks,
};

const NO_PAGES: ReadonlySet<SettingsCategory> = new Set();

export function SettingsSidebar({
  category,
  hidden = NO_PAGES,
  onCategoryChange,
  onRowOpen,
}: {
  category: SettingsCategory;
  hidden?: ReadonlySet<SettingsCategory>;
  onCategoryChange: (category: SettingsCategory) => void;
  onRowOpen?: (page: SettingsCategory, title: string) => void;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const unsupported = useUnsupportedFeatures();
  const text = t.settings.categories;
  const [query, setQuery] = useState("");
  const [folded, setFolded] = useState<ReadonlySet<SettingsGroup>>(() => new Set());
  const toggle = (group: SettingsGroup) => {
    const next = new Set(folded);
    if (!next.delete(group)) next.add(group);
    setFolded(next);
  };
  const groupOf = (item: SettingsCategory) => SETTINGS_GROUPS.find((group) => group.categories.includes(item))?.label;
  const describe = (item: SettingsCategory) => {
    const group = groupOf(item);
    return `${text[item]} ${group ? text.groups[group] : ""} ${text.keywords[item]}`;
  };
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector(".settings-sidebar__item--active")?.scrollIntoView({ block: "nearest" });
  }, [category, folded]);
  const searching = query.trim() !== "";
  const matches = searchCategories(query, describe);
  const hits = onRowOpen && searching ? searchSettingsRows(query, SEARCH_ENTRIES, locale, LOCALE_CODES, describe) : [];
  const shown = (item: SettingsCategory) =>
    isCategoryAvailable(item, unsupported) &&
    (searching ? matches.includes(item) || hits.some((hit) => hit.page === item) : item === category || !hidden.has(item));
  const anyHidden = !searching && [...hidden].some((item) => item !== category && isCategoryAvailable(item, unsupported));
  const openHit = (hit: SettingsRowHit) => onRowOpen?.(hit.page, hit.text.title);
  const openBest = () => {
    if (isTitleHit(hits[0], query)) openHit(hits[0]);
    else if (matches.length > 0) onCategoryChange(matches[0]);
    else if (hits.length > 0) openHit(hits[0]);
  };
  const pageHits = (page: SettingsCategory) => {
    const found = hits.filter((hit) => hit.page === page).slice(0, MAX_HITS_PER_PAGE);
    if (found.length === 0) return null;
    return (
      <ul className="settings-sidebar__hits">
        {found.map((hit) => {
          const path = [text[page], hit.text.group, hit.text.title].filter(Boolean).join(" › ");
          return (
            <li key={`${hit.text.group}/${hit.text.title}`}>
              <button className="settings-sidebar__hit" type="button" title={path} data-page={page} onClick={() => openHit(hit)}>
                <span>{hit.text.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const item = (entry: SettingsCategory, nested = false) => {
    const Icon = CATEGORY_ICONS[entry];
    const isActive = entry === category;
    return (
      <li key={entry}>
        <button
          className={`settings-sidebar__item${nested ? " settings-sidebar__item--nested" : ""}${isActive ? " settings-sidebar__item--active" : ""}`}
          type="button"
          aria-current={isActive ? "page" : undefined}
          data-category={entry}
          onClick={() => onCategoryChange(entry)}
        >
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
          <span>{text[entry]}</span>
        </button>
        {searching && pageHits(entry)}
      </li>
    );
  };

  const groups = SETTINGS_GROUPS.filter((group) => group.label !== null);
  const loose = (atEnd: boolean) =>
    SETTINGS_GROUPS.filter((group, index) => group.label === null && (index === 0) !== atEnd).flatMap((group) => group.categories).filter(shown);
  const header = loose(false);
  const footer = loose(true);
  const moreFeatures = (
    <li key="more">
      <button className="settings-sidebar__item settings-sidebar__item--nested settings-sidebar__more" type="button" onClick={() => onCategoryChange("overview")}>
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
        <span>{t.settings.overview.moreFeatures}</span>
      </button>
    </li>
  );

  return (
    <nav className="settings-sidebar" aria-label={text.label}>
      <div className="settings-sidebar__search">
        <Search size={14} strokeWidth={2} aria-hidden="true" />
        <input
          type="text"
          value={query}
          placeholder={text.search.placeholder}
          aria-label={text.search.placeholder}
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && searching) openBest();
            if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
            }
          }}
        />
        {query && (
          <button className="settings-sidebar__search-clear" type="button" aria-label={text.search.clear} onClick={() => setQuery("")}>
            <X size={13} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="settings-sidebar__list" ref={listRef}>
        {header.length > 0 && <ul className="settings-sidebar__top">{header.map((entry) => item(entry))}</ul>}
        {groups.map((group) => {
          const items = group.categories.filter(shown);
          const name = group.label;
          if (name === null || (items.length === 0 && !(name === "features" && anyHidden))) return null;
          const label = text.groups[name];
          const GroupIcon = GROUP_ICONS[name];
          const open = searching || !folded.has(name);
          const children = open ? items : items.filter((entry) => entry === category);
          const holdsActive = items.includes(category);
          return (
            <section className="settings-sidebar__group" key={name} aria-label={label}>
              <button
                className={`settings-sidebar__folder${holdsActive ? " settings-sidebar__folder--holds-active" : ""}`}
                type="button"
                data-group={name}
                aria-expanded={open}
                aria-label={open ? text.collapse(label) : text.expand(label)}
                disabled={searching}
                onClick={() => toggle(name)}
              >
                <GroupIcon size={16} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
                <ChevronRight className="settings-sidebar__chevron" size={14} strokeWidth={2} aria-hidden="true" />
              </button>
              {(children.length > 0 || (open && name === "features" && anyHidden)) && (
                <ul className="settings-sidebar__children">
                  {children.map((entry) => item(entry, true))}
                  {open && name === "features" && anyHidden && moreFeatures}
                </ul>
              )}
            </section>
          );
        })}
        {searching && matches.length === 0 && hits.length === 0 && <p className="settings-sidebar__empty">{text.search.empty}</p>}
      </div>
      {footer.length > 0 && (
        <div className="settings-sidebar__footer">
          <ul>{footer.map((entry) => item(entry))}</ul>
        </div>
      )}
    </nav>
  );
}
