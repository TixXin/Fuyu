import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ExternalLink, Search } from "lucide-react";
import { useLocale, useTranslation } from "../../../i18n";
import { openPluginViewLink, runPluginViewAction, searchPluginView } from "../api";
import { viewIcon } from "../icons";
import { filterListGroups, listRowCount, moveSelection, normalizeListModel, openableItems, type ListItem } from "../model";
import { onOpenRequest, takeOpenRequest } from "../openRequests";
import "./ListTemplate.css";

const SEARCH_DELAY_MS = 250;

export function ListTemplate({
  pluginId,
  viewId,
  model,
  onRowsChange,
}: {
  pluginId: string;
  viewId: string;
  model: unknown;
  onRowsChange?: (rows: number) => void;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const list = useMemo(() => normalizeListModel(model, locale), [locale, model]);
  const [query, setQuery] = useState<string | null>(null);
  const remote = list.search?.mode === "remote";
  const groups = remote ? list.groups : filterListGroups(list.groups, query ?? "");
  const openable = useMemo(() => openableItems(groups), [groups]);
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const rowId = useId();
  const hasSearch = list.search !== null;
  const current = searching ? openable[Math.min(selected, openable.length - 1)] ?? null : null;
  const currentId = current?.id ?? null;
  const rows = Math.max(listRowCount(groups), groups.length === 0 ? 3 : 0) + (list.search ? 1 : 0) + (list.error ? 1 : 0);

  useEffect(() => {
    onRowsChange?.(rows);
  }, [onRowsChange, rows]);

  useEffect(() => {
    if (!remote || query === null) return;
    const timer = window.setTimeout(() => {
      void searchPluginView(pluginId, viewId, query).catch((error: unknown) => console.error("Failed to search a plugin view", error));
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pluginId, query, remote, viewId]);

  useEffect(() => {
    if (!hasSearch) return;
    const focusIfAsked = () => {
      if (takeOpenRequest(pluginId, viewId, Date.now())) input.current?.focus();
    };
    focusIfAsked();
    return onOpenRequest(focusIfAsked);
  }, [hasSearch, pluginId, viewId]);

  useEffect(() => {
    if (currentId === null) return;
    scroll.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  const act = (actionId: string, item: ListItem | null, checked: boolean | null = null) => {
    void runPluginViewAction(pluginId, viewId, actionId, item?.id ?? null, checked).catch((error: unknown) =>
      console.error("Failed to send a plugin view action", error),
    );
  };

  const open = (item: ListItem) => {
    if (item.url) void openPluginViewLink(item.url);
    else if (item.action) act(item.action, item);
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => moveSelection(Math.min(index, openable.length - 1), openable.length, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && current) {
      event.preventDefault();
      open(current);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
      setSelected(0);
    }
  };

  return (
    <div className="plugin-list">
      {list.search ? (
        <label className="plugin-list__search">
          <Search size={13} strokeWidth={2.3} aria-hidden="true" />
          <input
            ref={input}
            type="search"
            value={query ?? ""}
            placeholder={list.search.placeholder ?? t.pluginViews.search}
            aria-label={list.search.placeholder ?? t.pluginViews.search}
            maxLength={200}
            aria-activedescendant={currentId === null ? undefined : `${rowId}-${currentId}`}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setSelected(0);
            }}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            onKeyDown={onSearchKey}
          />
        </label>
      ) : null}
      {list.error ? <p className="plugin-list__error" role="alert">{list.error}</p> : null}
      <div className="plugin-list__scroll" aria-busy={list.loading} ref={scroll}>
        {list.loading && groups.length === 0 ? <p className="plugin-list__empty">{t.pluginViews.loading}</p> : null}
        {!list.loading && groups.length === 0 ? <p className="plugin-list__empty">{list.empty ?? t.pluginViews.empty}</p> : null}
        {groups.map((group) => (
          <div className="plugin-list__group" role="list" aria-label={group.title ?? undefined} key={group.key}>
            {group.title ? <h3 className="plugin-list__group-title">{group.title}</h3> : null}
            {group.items.map((item) => (
              <PluginListRow key={item.id} item={item} domId={`${rowId}-${item.id}`} selected={item.id === currentId} onOpen={open} onAction={act} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PluginListRow({
  item,
  domId,
  selected,
  onOpen,
  onAction,
}: {
  item: ListItem;
  domId: string;
  selected: boolean;
  onOpen: (item: ListItem) => void;
  onAction: (actionId: string, item: ListItem, checked?: boolean | null) => void;
}) {
  const t = useTranslation();
  const Icon = item.icon ? viewIcon(item.icon) : null;
  const clickable = Boolean(item.url || item.action);
  const text = (
    <>
      {Icon ? <Icon className="plugin-list__icon" size={14} strokeWidth={2.2} aria-hidden="true" /> : null}
      <span className="plugin-list__text">
        <span className="plugin-list__title">{item.title}</span>
        {item.subtitle ? <span className="plugin-list__subtitle">{item.subtitle}</span> : null}
      </span>
      {item.note ? <span className="plugin-list__note">{item.note}</span> : null}
      {item.url ? <ExternalLink className="plugin-list__link" size={12} strokeWidth={2.3} aria-hidden="true" /> : null}
    </>
  );

  return (
    <div
      id={domId}
      className={`plugin-list__item${item.checked ? " plugin-list__item--checked" : ""}${selected ? " plugin-list__item--selected" : ""}`}
      role="listitem"
      data-selected={selected ? "true" : undefined}
    >
      {item.checked !== null ? (
        <button
          className="plugin-list__check"
          type="button"
          role="checkbox"
          aria-checked={item.checked}
          aria-label={item.title}
          onClick={() => onAction("check", item, !item.checked)}
        >
          {item.checked ? <Check size={12} strokeWidth={2.8} /> : null}
        </button>
      ) : null}
      {clickable ? (
        <button className="plugin-list__main" type="button" onClick={() => onOpen(item)}>
          {text}
        </button>
      ) : (
        <div className="plugin-list__main">
          {text}
        </div>
      )}
      {item.actions.length > 0 ? (
        <div className="plugin-list__actions" role="group" aria-label={t.pluginViews.actions}>
          {item.actions.map((action) => {
            const ActionIcon = action.icon ? viewIcon(action.icon) : null;
            return (
              <button
                className="plugin-list__action"
                type="button"
                key={action.id}
                aria-label={`${action.title}: ${item.title}`}
                onClick={() => onAction(action.id, item)}
              >
                {ActionIcon ? <ActionIcon size={12} strokeWidth={2.4} aria-hidden="true" /> : <span>{action.title}</span>}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
