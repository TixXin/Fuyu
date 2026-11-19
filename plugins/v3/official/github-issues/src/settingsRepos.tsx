import { useState } from "react";
import { XIcon } from "./icons.tsx";
import { MAX_REPOS, METHODS, type AddRepoResult } from "./model.ts";
import { text } from "./text.ts";

type Invoke = (method: string, params?: unknown) => void;

export function RepoList({
  repos,
  invoke,
  addRepo,
}: {
  repos: readonly string[];
  invoke: Invoke;
  addRepo: (repo: string) => Promise<AddRepoResult>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const full = repos.length >= MAX_REPOS;

  async function submit() {
    const value = draft.trim();
    if (!value || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await addRepo(value);
      if (result.ok) setDraft("");
      else setProblem(text.addErrors[result.reason]);
    } catch {
      setProblem(text.addErrors.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className="fuyu-gh-set__add"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          className="fuyu-gh-set__input"
          value={draft}
          placeholder={text.addPlaceholder}
          aria-label={text.reposTitle}
          disabled={full}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(event) => {
            setDraft(event.target.value);
            setProblem(null);
          }}
        />
        <button type="submit" className="fuyu-gh-set__button is-primary" disabled={busy || full || draft.trim() === ""}>
          {busy ? text.checking : text.add}
        </button>
      </form>
      {(problem || full) && <p className="fuyu-gh-set__hint is-warn">{problem ?? text.addErrors.full}</p>}
      {repos.length > 0 && (
        <ul className="fuyu-gh-set__repos">
          {repos.map((repo) => (
            <li key={repo} className="fuyu-gh-set__repo">
              <span className="fuyu-gh-set__name" title={repo}>
                {repo}
              </span>
              <button
                type="button"
                className="fuyu-gh-set__icon"
                title={text.remove}
                aria-label={`${text.remove} ${repo}`}
                onClick={() => invoke(METHODS.removeRepo, { repo })}
              >
                <XIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
