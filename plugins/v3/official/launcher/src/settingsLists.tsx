import { useMemo, useState } from "react";
import { METHODS, filterApps } from "./model.ts";
import { text } from "./text.ts";
import type { useLauncher } from "./useLauncher.ts";

type Launcher = ReturnType<typeof useLauncher>;

const MAX_MATCHES = 6;

export function ExtraDirs({ launcher }: { launcher: Launcher }) {
  const { state, invoke, setSettings, error } = launcher;
  const [draft, setDraft] = useState("");
  const dirs = state.settings.extraDirs;

  const add = async () => {
    const dir = draft.trim();
    if (!dir) return;
    const next = await invoke(METHODS.addExtraDir, { dir });
    if (next) setDraft("");
  };

  return (
    <>
      {dirs.length > 0 && (
        <ul className="fuyu-launcher-set__list">
          {dirs.map((dir) => (
            <li key={dir} className="fuyu-launcher-set__item">
              <span className="fuyu-launcher-set__path" title={dir}>
                {dir}
              </span>
              <button
                type="button"
                className="fuyu-launcher-set__link"
                onClick={() => void setSettings({ extraDirs: dirs.filter((item) => item !== dir) })}
              >
                {text.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="fuyu-launcher-set__add"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <input
          className="fuyu-launcher-set__input"
          value={draft}
          placeholder={text.extraDirPlaceholder}
          aria-label={text.extraDirPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="fuyu-launcher-set__button" disabled={!draft.trim()}>
          {text.add}
        </button>
      </form>
      {error?.includes("missing-dir") && <p className="fuyu-launcher-set__warn">{text.dirMissing}</p>}
    </>
  );
}

export function ExcludedApps({ launcher }: { launcher: Launcher }) {
  const { state, setSettings } = launcher;
  const [query, setQuery] = useState("");
  const excluded = state.settings.excluded;
  const matches = useMemo(
    () => (query.trim() ? filterApps(state.apps, query).slice(0, MAX_MATCHES) : []),
    [state.apps, query],
  );

  return (
    <>
      <input
        className="fuyu-launcher-set__input"
        value={query}
        placeholder={text.excludeSearch}
        aria-label={text.excludeSearch}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.length > 0 && (
        <ul className="fuyu-launcher-set__list">
          {matches.map((app) => (
            <li key={app.path} className="fuyu-launcher-set__item">
              <span className="fuyu-launcher-set__path" title={app.path}>
                {app.name}
                {app.folder && <span className="fuyu-launcher-set__sub"> · {app.folder}</span>}
              </span>
              <button
                type="button"
                className="fuyu-launcher-set__link"
                onClick={() => void setSettings({ excluded: [...excluded, app.path] })}
              >
                {text.exclude}
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.excludedApps.length === 0 ? (
        <p className="fuyu-launcher-set__hint">{text.noExcluded}</p>
      ) : (
        <ul className="fuyu-launcher-set__list">
          {state.excludedApps.map((app) => (
            <li key={app.path} className="fuyu-launcher-set__item">
              <span className="fuyu-launcher-set__path" title={app.path}>
                {app.name}
              </span>
              <button
                type="button"
                className="fuyu-launcher-set__link"
                onClick={() => void setSettings({ excluded: excluded.filter((path) => path !== app.path) })}
              >
                {text.restore}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
