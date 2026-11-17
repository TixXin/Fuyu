import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState } from "react";
import { TEXT, parseRepos } from "./types.ts";
import { useIssues } from "./useIssues.ts";
import "./styles.css";

export default function apply(ctx: Context) {
  function IssuesSection() {
    const { state, locale, error, saveConfig, refresh } = useIssues(ctx);
    const copy = TEXT[locale];

    const [reposText, setReposText] = useState(state.config.reposText);
    const [minutes, setMinutes] = useState(String(state.config.refreshMinutes));
    const [notifyNew, setNotifyNew] = useState(state.config.notifyNew);

    useEffect(() => {
      setReposText(state.config.reposText);
      setMinutes(String(state.config.refreshMinutes));
      setNotifyNew(state.config.notifyNew);
    }, [state.config.reposText, state.config.refreshMinutes, state.config.notifyNew]);

    const parsed = parseRepos(reposText);

    const onSave = () => {
      void saveConfig({
        reposText: reposText.trim(),
        refreshMinutes: Number(minutes) || 15,
        notifyNew,
      });
    };

    return (
      <section className="fuyu-gh-issues-settings">
        <h3 className="fuyu-gh-issues__title">{copy.title}</h3>

        <label className="fuyu-gh-issues-settings__field">
          <span className="fuyu-gh-issues-settings__label">{copy.reposLabel}</span>
          <input
            type="text"
            className="fuyu-gh-issues__input"
            value={reposText}
            placeholder={copy.reposPlaceholder}
            onChange={(event) => setReposText(event.target.value)}
          />
        </label>

        {parsed.invalidRepos.length > 0 && (
          <p className="fuyu-gh-issues__note">{copy.invalidRepos(parsed.invalidRepos)}</p>
        )}

        <label className="fuyu-gh-issues-settings__field">
          <span className="fuyu-gh-issues-settings__label">{copy.refreshMinutes}</span>
          <input
            type="number"
            min={5}
            max={120}
            className="fuyu-gh-issues__input"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>

        <label className="fuyu-gh-issues-settings__check">
          <span>{copy.notifyNew}</span>
          <input
            type="checkbox"
            checked={notifyNew}
            onChange={(event) => setNotifyNew(event.target.checked)}
          />
        </label>

        <div className="fuyu-gh-issues-settings__actions">
          <button type="button" className="fuyu-gh-issues__button" onClick={onSave}>
            {copy.save}
          </button>
          <button
            type="button"
            className="fuyu-gh-issues__button fuyu-gh-issues__button--secondary"
            disabled={state.repos.length === 0 || state.loading}
            onClick={refresh}
          >
            {copy.refresh}
          </button>
        </div>

        {error && <p className="fuyu-gh-issues__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", {
    id: "@fuyu/github-issues",
    category: "pluginsV3",
    component: IssuesSection,
  });
}
