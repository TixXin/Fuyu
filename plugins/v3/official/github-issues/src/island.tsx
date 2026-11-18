import type { Context } from "@fuyu/plugin-base";
import { useState } from "react";
import { TEXT } from "./types.ts";
import { useIssues } from "./useIssues.ts";
import "./styles.css";

function IssuesIcon({ size = 16 }: { size?: number | string }) {
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
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export default function apply(ctx: Context) {
  function IssuesPage() {
    const { state, locale, error, refresh } = useIssues(ctx);
    const copy = TEXT[locale];
    const [filter, setFilter] = useState("");
    const keyword = filter.trim().toLowerCase();

    if (state.repos.length === 0) {
      return (
        <div className="fuyu-gh-issues">
          <div className="fuyu-gh-issues__empty">
            <strong className="fuyu-gh-issues__title">{copy.emptyTitle}</strong>
            <p className="fuyu-gh-issues__note">{copy.emptyBody}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="fuyu-gh-issues">
        <div className="fuyu-gh-issues__toolbar">
          <input
            type="search"
            className="fuyu-gh-issues__input"
            placeholder={copy.filterPlaceholder}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <button
            type="button"
            className="fuyu-gh-issues__button"
            disabled={state.loading}
            onClick={refresh}
          >
            {state.loading ? copy.loading : copy.refresh}
          </button>
        </div>

        <div className="fuyu-gh-issues__groups">
          {state.groups.map((group) => {
            const visible = keyword
              ? group.items.filter(
                  (item) =>
                    item.title.toLowerCase().includes(keyword) ||
                    `#${item.number}`.includes(keyword) ||
                    item.author.toLowerCase().includes(keyword),
                )
              : group.items;

            return (
              <div key={group.repo} className="fuyu-gh-issues__group">
                <div className="fuyu-gh-issues__group-head">
                  <span className="fuyu-gh-issues__repo">{group.repo}</span>
                  <span className="fuyu-gh-issues__badge">{copy.openCount(visible.length)}</span>
                </div>

                {group.error && <p className="fuyu-gh-issues__note">{group.error}</p>}

                {!group.error && visible.length === 0 ? (
                  <p className="fuyu-gh-issues__note">{copy.noOpenIssues}</p>
                ) : (
                  <ul className="fuyu-gh-issues__list">
                    {visible.map((item) => (
                      <li key={item.id}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="fuyu-gh-issues__row"
                        >
                          <div className="fuyu-gh-issues__row-main">
                            <span className="fuyu-gh-issues__row-title">{item.title}</span>
                            <span className="fuyu-gh-issues__row-meta">
                              {`#${item.number}${item.author ? ` · ${item.author}` : ""}${item.updatedDate ? ` · ${item.updatedDate}` : ""}`}
                            </span>
                          </div>
                          {item.comments > 0 && (
                            <span className="fuyu-gh-issues__comments">{item.comments}</span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="fuyu-gh-issues__note">{error}</p>}
      </div>
    );
  }

  ctx.slots.add("island.page/v1", {
    id: "@fuyu/github-issues",
    component: IssuesPage,
    icon: IssuesIcon,
  });
}
