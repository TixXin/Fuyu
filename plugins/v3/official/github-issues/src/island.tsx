import type { Context } from "@fuyu/plugin-base";
import { useEffect, useRef, useState } from "react";
import { CommentIcon, IssuesIcon } from "./icons.tsx";
import {
  FILTER_THRESHOLD,
  METHODS,
  matchesFilter,
  openTotal,
  relativeAge,
  type IssueItem,
  type IssuesSettings,
  type RepoError,
  type RepoGroup,
} from "./model.ts";
import { PAGE_TITLE, text } from "./text.ts";
import { useIssues } from "./useIssues.ts";
import "./styles.css";

const PAGE_ID = "@fuyu/github-issues";

type SettingsOpener = { settings?: { open?: () => unknown } };

function settingsOpener(ctx: Context): (() => unknown) | null {
  const holder = (ctx as unknown as SettingsOpener).settings;
  const open = holder?.open;
  return typeof open === "function" ? () => open.call(holder) : null;
}

function clock(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function errorLabel(error: RepoError): string {
  if (error.kind === "notFound") return text.notFound;
  if (error.kind === "rate") return text.rateExhausted(clock(error.resetUnix));
  return text.loadFailed(error.message);
}

function Row({ item, settings, at }: { item: IssueItem; settings: IssuesSettings; at: number }) {
  const age = settings.showUpdated ? relativeAge(item.updatedAt, at) : null;
  return (
    <li>
      <a href={item.url} target="_blank" rel="noreferrer" className="fuyu-gh-issues__row" title={item.title}>
        <span className="fuyu-gh-issues__row-main">
          <span className="fuyu-gh-issues__row-title">{item.title}</span>
          <span className="fuyu-gh-issues__row-meta">
            <span>{`#${item.number}`}</span>
            {item.pull && <span className="fuyu-gh-issues__tag">{text.pr}</span>}
            {age && <span>{text.age(age)}</span>}
            {settings.showAuthor && item.author && <span className="fuyu-gh-issues__author">{item.author}</span>}
          </span>
        </span>
        {settings.showComments && item.comments > 0 && (
          <span className="fuyu-gh-issues__comments" title={text.comments(item.comments)}>
            <CommentIcon />
            {item.comments}
          </span>
        )}
      </a>
    </li>
  );
}

function Group({ group, settings, keyword, at }: { group: RepoGroup; settings: IssuesSettings; keyword: string; at: number }) {
  const [open, setOpen] = useState(false);
  const matched = group.items.filter((item) => matchesFilter(item, keyword));
  const folded = !keyword && !open && matched.length > settings.perRepo;
  const shown = folded ? matched.slice(0, settings.perRepo) : matched;
  let note: string | null = null;
  if (group.error) note = errorLabel(group.error);
  else if (!group.loaded) note = text.loadingRepo;
  else if (matched.length === 0) note = keyword ? text.noMatch : text.noOpenIssues;
  return (
    <div className="fuyu-gh-issues__group">
      <div className="fuyu-gh-issues__group-head">
        <span className="fuyu-gh-issues__repo">{group.repo}</span>
        {group.loaded && !group.error && <span className="fuyu-gh-issues__badge">{text.count(group.items.length, group.more)}</span>}
      </div>
      {note ? (
        <p className="fuyu-gh-issues__note">{note}</p>
      ) : (
        <ul className="fuyu-gh-issues__list">
          {shown.map((item) => (
            <Row key={item.id} item={item} settings={settings} at={at} />
          ))}
        </ul>
      )}
      {!keyword && matched.length > settings.perRepo && (
        <button type="button" className="fuyu-gh-issues__more" onClick={() => setOpen(!open)}>
          {open ? text.showLess : text.showMore(matched.length - settings.perRepo)}
        </button>
      )}
    </div>
  );
}

export default function apply(ctx: Context) {
  const openSettings = settingsOpener(ctx);

  function IssuesPage() {
    const { state, ready, error, invoke } = useIssues(ctx);
    const [filter, setFilter] = useState("");
    const opened = useRef(false);
    const { settings } = state;
    const keyword = filter.trim().toLowerCase();
    const total = state.groups.reduce((sum, group) => sum + group.items.length, 0);
    const showFilter = total > FILTER_THRESHOLD;

    useEffect(() => {
      if (!ready || opened.current) return;
      opened.current = true;
      if (settings.refreshOnOpen && settings.repos.length > 0) invoke(METHODS.refresh, { soft: true });
    }, [ready, settings.refreshOnOpen, settings.repos.length, invoke]);

    if (!ready) return <div className="fuyu-gh-issues" />;

    if (settings.repos.length === 0) {
      return (
        <div className="fuyu-gh-issues">
          <div className="fuyu-gh-issues__empty">
            <p className="fuyu-gh-issues__note">{openSettings ? text.noRepos : `${text.noRepos} ${text.noReposHint}`}</p>
            {openSettings && (
              <button type="button" className="fuyu-gh-issues__go" onClick={() => void openSettings()}>
                {text.goSettings}
              </button>
            )}
          </div>
        </div>
      );
    }

    const at = Date.now();
    return (
      <div className="fuyu-gh-issues">
        <div className="fuyu-gh-issues__toolbar">
          {showFilter ? (
            <input
              type="search"
              className="fuyu-gh-issues__input"
              placeholder={text.filterPlaceholder}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          ) : (
            <span className="fuyu-gh-issues__spacer" />
          )}
          <button type="button" className="fuyu-gh-issues__refresh" disabled={state.loading} onClick={() => invoke(METHODS.refresh)}>
            {state.loading ? text.refreshing : text.refresh}
          </button>
        </div>
        <div className="fuyu-gh-issues__groups">
          {state.groups.map((group) => (
            <Group key={group.repo} group={group} settings={settings} keyword={showFilter ? keyword : ""} at={at} />
          ))}
        </div>
        {error && <p className="fuyu-gh-issues__note">{error}</p>}
      </div>
    );
  }

  function IssuesCollapsed() {
    const { state } = useIssues(ctx);
    if (!state.settings.showInBar || state.settings.repos.length === 0) return null;
    const loaded = state.groups.some((group) => group.loaded);
    if (!loaded) return null;
    const { count, more } = openTotal(state.groups);
    return (
      <span className="fuyu-gh-issues-chip" title={`${text.title} · ${text.barTitle(count)}`}>
        <IssuesIcon size={12} />
        <span className="fuyu-gh-issues-chip__count">{text.count(count, more)}</span>
      </span>
    );
  }

  ctx.slots.add("island.page/v1", { id: PAGE_ID, title: PAGE_TITLE, component: IssuesPage, icon: IssuesIcon });
  ctx.slots.add("island.collapsed/v1", {
    id: "github-issues-bar",
    hideable: true,
    opens: PAGE_ID,
    component: IssuesCollapsed,
  });
}
