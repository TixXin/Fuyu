import { useEffect, useRef, useState } from "react";
import { Blocks, Bot, ChevronRight, Plus, LayoutGrid, Search, Settings2, X, type LucideIcon } from "lucide-react";
import { LOCALE_CODES, useLocale, useTranslation } from "../../i18n";
import { isMacOS, useUnsupportedFeatures } from "../../lib/platform";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { entryOf, entryPages, isCategoryAvailable, isEntry, searchCategories, settingsGroups, sidebarItemOf, subPagesOf, type SettingsCategory, type SettingsGroup, type TabbedCategory } from "./categories";
import { rememberedAboutPage } from "./storage";
import { isTitleHit, MAX_HITS_PER_PAGE, searchSettingsRows, type SettingsRowHit, type SettingsSearchEntry } from "./settingsSearch";
import { BUILTIN_CATEGORIES, categorySlot } from "./slots/categorySlot";
import "./SettingsSidebar.css";

export const CATEGORY_ICONS = Object.fromEntries(BUILTIN_CATEGORIES.map((item) => [item.id, item.icon])) as Record<SettingsCategory, LucideIcon>;

const EMPTY_SEARCH_ENTRIES: SettingsSearchEntry[] = [];
let cachedSearchEntries: SettingsSearchEntry[] | null = null;
let loadingSearchEntries: Promise<SettingsSearchEntry[]> | null = null;

export function isSearchIndexLoaded(): boolean {
  return cachedSearchEntries !== null;
}

function loadSearchEntries(): Promise<SettingsSearchEntry[]> {
  if (cachedSearchEntries) return Promise.resolve(cachedSearchEntries);
  loadingSearchEntries ??= import("./searchIndex.json").then((mod) => {
    cachedSearchEntries = mod.default.entries as SettingsSearchEntry[];
    return cachedSearchEntries;
  });
  return loadingSearchEntries;
}

const GROUP_ICONS: Record<SettingsGroup, LucideIcon> = {
  basics: Settings2,
  features: LayoutGrid,
  agents: Bot,
  extensions: Blocks,
};

const NO_PAGES: ReadonlySet<SettingsCategory> = new Set();

export function SettingsSidebar({
  category,
  hidden,
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
  const slotItems = useSlotEntries(categorySlot);
  const hiddenSet = hidden ?? NO_PAGES;
  const groups = settingsGroups(hidden && slotItems.length > 0 ? undefined : slotItems);
  const text = t.settings.categories;
  const [query, setQuery] = useState("");
  const [searchEntries, setSearchEntries] = useState<SettingsSearchEntry[]>(() => cachedSearchEntries ?? EMPTY_SEARCH_ENTRIES);
  const [folded, setFolded] = useState<ReadonlySet<SettingsGroup>>(() => new Set());
  const toggle = (group: SettingsGroup) => {
    const next = new Set(folded);
    if (!next.delete(group)) next.add(group);
    setFolded(next);
  };
  const groupOf = (item: SettingsCategory) => groups.find((group) => group.categories.includes(sidebarItemOf(item)))?.label;
  const itemLabel = (item: SettingsCategory) => (isEntry(item) ? text.entries[item] : text[item]);
  const pageLabel = (page: SettingsCategory) => (entryOf(page) ? text.tabs[page as TabbedCategory] : text[page]);
  const describe = (item: SettingsCategory) => {
    const group = groupOf(item);
    const entry = entryOf(item);
    return `${text[item]} ${entry ? `${text.tabs[item as TabbedCategory]} ${text.entries[entry]}` : ""} ${group ? text.groups[group] : ""} ${text.keywords[item]}`;
  };
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector(".settings-sidebar__item--active")?.scrollIntoView({ block: "nearest" });
  }, [category, folded]);
  const searching = query.trim() !== "";
  useEffect(() => {
    if (!onRowOpen || !searching || cachedSearchEntries) return;
    let cancelled = false;
    void loadSearchEntries().then((entries) => {
      if (!cancelled) setSearchEntries(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [onRowOpen, searching]);
  const ensureSearchIndex = () => {
    if (!onRowOpen) return;
    if (cachedSearchEntries) {
      if (searchEntries !== cachedSearchEntries) setSearchEntries(cachedSearchEntries);
      return;
    }
    void loadSearchEntries().then(setSearchEntries);
  };
  const matches = searchCategories(query, describe);
  const hits = onRowOpen && searching ? searchSettingsRows(query, searchEntries, locale, LOCALE_CODES, describe) : [];
  const available = (page: SettingsCategory) => isCategoryAvailable(page, unsupported, isMacOS);
  const pagesOf = (item: SettingsCategory) => entryPages(item).filter(available);
  const subsOf = (item: SettingsCategory) => subPagesOf(item).filter(available);
  const found = (page: SettingsCategory) => matches.includes(page) || hits.some((hit) => hit.page === page);
  const shown = (item: SettingsCategory) =>
    searching ? [...pagesOf(item), ...subsOf(item)].some(found) : pagesOf(item).some((page) => page === category || !hiddenSet.has(page));
  const anyHidden = !searching && [...hiddenSet].some((page) => page !== category && available(page));
  const current = sidebarItemOf(category);
  const openHit = (hit: SettingsRowHit) => onRowOpen?.(hit.page, hit.text.title);
  const openItem = (item: SettingsCategory) => {
    if (item === "about") return onCategoryChange(rememberedAboutPage());
    const pages = pagesOf(item);
    onCategoryChange(pages.find((page) => !hiddenSet.has(page)) ?? pages[0] ?? item);
  };
  const openBest = () => {
    if (isTitleHit(hits[0], query)) openHit(hits[0]);
    else if (matches.length > 0) onCategoryChange(matches[0]);
    else if (hits.length > 0) openHit(hits[0]);
  };
  const itemHits = (item: SettingsCategory) => {
    const tabbed = entryPages(item).length > 1;
    const subs = subsOf(item);
    const tabs = [...(tabbed ? pagesOf(item) : []), ...subs].filter((page) => matches.includes(page));
    const rows = [...pagesOf(item), ...subs].flatMap((page) => hits.filter((hit) => hit.page === page).slice(0, MAX_HITS_PER_PAGE));
    if (tabs.length === 0 && rows.length === 0) return null;
    return (
      <ul className="settings-sidebar__hits">
        {tabs.map((page) => (
          <li key={`tab/${page}`}>
            <button className="settings-sidebar__hit settings-sidebar__hit--tab" type="button" data-tab={page} onClick={() => onCategoryChange(page)}>
              <span>{pageLabel(page)}</span>
            </button>
          </li>
        ))}
        {rows.map((hit) => {
          const path = [itemLabel(item), tabbed || hit.page !== item ? pageLabel(hit.page) : "", hit.text.group, hit.text.title].filter((part, index, parts) => part && part !== parts[index - 1]).join(" › ");
          return (
            <li key={`${hit.page}/${hit.text.group}/${hit.text.title}`}>
              <button className="settings-sidebar__hit" type="button" title={path} data-page={hit.page} onClick={() => openHit(hit)}>
                <span>{hit.text.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const item = (entry: SettingsCategory, nested = false) => {
    const Icon = slotItems.find((other) => other.id === entry)?.icon ?? CATEGORY_ICONS[entry];
    const isActive = entry === current;
    return (
      <li key={entry}>
        <button
          className={`settings-sidebar__item${nested ? " settings-sidebar__item--nested" : ""}${isActive ? " settings-sidebar__item--active" : ""}`}
          type="button"
          aria-current={isActive ? "page" : undefined}
          data-category={entry}
          onClick={() => openItem(entry)}
        >
          {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" />}
          <span>{itemLabel(entry)}</span>
        </button>
        {searching && itemHits(entry)}
      </li>
    );
  };

  const lastGroup = groups.length - 1;
  const footer = groups[lastGroup].label === null ? groups[lastGroup].categories.filter(shown) : [];
  const moreFeatures = (
    <li key="more">
      <button className="settings-sidebar__item settings-sidebar__item--nested settings-sidebar__more" type="button" onClick={() => onCategoryChange("overview")}>
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
        <span>{t.settings.overview.moreFeatures}</span>
      </button>
    </li>
  );
  const group = (name: SettingsGroup, categories: readonly SettingsCategory[]) => {
    const items = categories.filter(shown);
    const more = name === "features" && anyHidden;
    if (items.length === 0 && !more) return null;
    const label = text.groups[name];
    const GroupIcon = GROUP_ICONS[name];
    const open = searching || !folded.has(name);
    const children = open ? items : items.filter((entry) => entry === current);
    return (
      <section className="settings-sidebar__group" key={name} aria-label={label}>
        <button
          className={`settings-sidebar__folder${items.includes(current) ? " settings-sidebar__folder--holds-active" : ""}`}
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
        {(children.length > 0 || (open && more)) && (
          <ul className="settings-sidebar__children">
            {children.map((entry) => item(entry, true))}
            {open && more && moreFeatures}
          </ul>
        )}
      </section>
    );
  };

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
          onFocus={ensureSearchIndex}
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
        {groups.map(({ label, categories }, index) => {
          if (label !== null) return group(label, categories);
          if (index === lastGroup) return null;
          const items = categories.filter(shown);
          return items.length > 0 ? <ul className="settings-sidebar__top" key={items.join()}>{items.map((entry) => item(entry))}</ul> : null;
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
