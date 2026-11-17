import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { messagesV1 } from "@fuyu/plugin-services";
import { fetchRepoIssues } from "./github.ts";
import {
  DEFAULT_CONFIG,
  METHODS,
  TEXT,
  TOPICS,
  parseRepos,
  type IssueItem,
  type IssuesConfig,
  type IssuesState,
  type Locale,
  type RateInfo,
  type RepoGroup,
} from "./types.ts";

export const name = "@fuyu/github-issues";
export const inject = ["clients", "messages/v1"];

const CONFIG_FILE = "config.json";
const ANONYMOUS_BUDGET_PER_HOUR = 50;

interface CachedRepo {
  items: IssueItem[];
  etag: string | null;
  error: string | null;
  loaded: boolean;
  knownNumbers: Set<number>;
}

function normalizeLocale(value: unknown): Locale {
  return value === "en" ? "en" : "zh-CN";
}

function normalizeMinutes(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return 15;
  return Math.max(5, Math.min(120, n));
}

function loadConfig(dir: string): IssuesConfig {
  try {
    const file = join(dir, CONFIG_FILE);
    if (!existsSync(file)) return { ...DEFAULT_CONFIG };
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<IssuesConfig>;
    return {
      reposText: typeof raw.reposText === "string" ? raw.reposText : "",
      refreshMinutes: normalizeMinutes(raw.refreshMinutes),
      notifyNew: raw.notifyNew === true,
      locale: normalizeLocale(raw.locale),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfigFile(dir: string, config: IssuesConfig): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function formatClock(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function apply(ctx: Context) {
  const messages = ctx.services.get(messagesV1);

  let config = loadConfig(ctx.dataDir);
  const cache = new Map<string, CachedRepo>();
  let rate: RateInfo | null = null;
  let loading = false;
  let stopTimer: (() => Promise<void>) | null = null;

  const isRateExhausted = (): boolean =>
    Boolean(rate && rate.remaining <= 0 && rate.resetUnix * 1000 > Date.now());

  const effectiveMinutes = (repoCount: number): number => {
    if (repoCount <= 0) return config.refreshMinutes;
    return Math.max(config.refreshMinutes, Math.ceil((repoCount * 60) / ANONYMOUS_BUDGET_PER_HOUR));
  };

  const snapshot = (): IssuesState => {
    const { repos, invalidRepos } = parseRepos(config.reposText);
    const groups: RepoGroup[] = repos.map((repo) => {
      const entry = cache.get(repo);
      return {
        repo,
        items: entry ? entry.items : [],
        error: entry ? entry.error : null,
        loaded: entry ? entry.loaded : false,
      };
    });
    return {
      config,
      repos,
      invalidRepos,
      groups,
      rate,
      loading,
      updatedAt: Date.now(),
    };
  };

  const publish = () => ctx.clients.publish(TOPICS.state, snapshot());

  async function refreshRepo(repo: string): Promise<void> {
    const copy = TEXT[config.locale];
    let entry = cache.get(repo);
    if (!entry) {
      entry = { items: [], etag: null, error: null, loaded: false, knownNumbers: new Set() };
      cache.set(repo, entry);
    }
    if (isRateExhausted() && rate) {
      entry.error = copy.rateExhausted(formatClock(rate.resetUnix));
      return;
    }
    try {
      const answer = await fetchRepoIssues(repo, entry.etag);
      if (answer.rate) {
        rate = answer.rate;
      }
      if (answer.status === 304) {
        entry.error = null;
        return;
      }
      if (answer.status === 200 && answer.items) {
        const hadLoaded = entry.loaded;
        const freshItems = hadLoaded
          ? answer.items.filter((item) => !entry.knownNumbers.has(item.number))
          : [];
        entry.items = answer.items;
        entry.etag = answer.etag;
        entry.error = null;
        entry.loaded = true;
        for (const item of answer.items) {
          entry.knownNumbers.add(item.number);
        }
        if (config.notifyNew && freshItems.length > 0) {
          const newest = freshItems[0];
          await messages.notify({
            source: name,
            pluginId: name,
            title: copy.newIssueTitle(repo),
            body: `#${newest.number} ${newest.title}`,
            durationMs: 8000,
          });
        }
        return;
      }
      if (answer.status === 404) {
        entry.items = [];
        entry.error = copy.notFound;
        return;
      }
      if (isRateExhausted() && rate) {
        entry.error = copy.rateExhausted(formatClock(rate.resetUnix));
        return;
      }
      entry.error = copy.loadFailed(answer.errorMessage ?? `HTTP ${answer.status}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      entry.error = copy.loadFailed(msg);
    }
  }

  async function refreshAll(): Promise<IssuesState> {
    const { repos } = parseRepos(config.reposText);
    for (const key of [...cache.keys()]) {
      if (!repos.includes(key)) cache.delete(key);
    }
    if (repos.length === 0) {
      loading = false;
      publish();
      return snapshot();
    }
    loading = true;
    publish();
    try {
      for (const repo of repos) {
        await refreshRepo(repo);
      }
    } finally {
      loading = false;
      publish();
    }
    return snapshot();
  }

  function syncSchedule() {
    if (stopTimer) {
      void stopTimer();
      stopTimer = null;
    }
    const { repos } = parseRepos(config.reposText);
    if (repos.length === 0) return;
    const mins = effectiveMinutes(repos.length);
    stopTimer = ctx.setInterval(() => {
      void refreshAll();
    }, mins * 60_000);
  }

  syncSchedule();
  if (parseRepos(config.reposText).repos.length > 0) {
    void refreshAll();
  }

  ctx.clients.handle(METHODS.getState, async (params?: { locale?: Locale }) => {
    if (params?.locale && params.locale !== config.locale) {
      config = { ...config, locale: normalizeLocale(params.locale) };
      saveConfigFile(ctx.dataDir, config);
    }
    return snapshot();
  });

  ctx.clients.handle(METHODS.setConfig, async (params?: Partial<IssuesConfig>) => {
    const prevRepos = config.reposText;
    config = {
      reposText: typeof params?.reposText === "string" ? params.reposText.trim() : config.reposText,
      refreshMinutes:
        params?.refreshMinutes !== undefined ? normalizeMinutes(params.refreshMinutes) : config.refreshMinutes,
      notifyNew: typeof params?.notifyNew === "boolean" ? params.notifyNew : config.notifyNew,
      locale: params?.locale ? normalizeLocale(params.locale) : config.locale,
    };
    saveConfigFile(ctx.dataDir, config);
    syncSchedule();
    if (config.reposText !== prevRepos) {
      return refreshAll();
    }
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.refresh, async (params?: { locale?: Locale }) => {
    if (params?.locale && params.locale !== config.locale) {
      config = { ...config, locale: normalizeLocale(params.locale) };
      saveConfigFile(ctx.dataDir, config);
    }
    return refreshAll();
  });
}
