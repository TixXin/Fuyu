import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { messagesV1 } from "@fuyu/plugin-services";
import { fetchRepoInfo, fetchRepoIssues, type RateInfo } from "./github.ts";
import {
  DEFAULT_SETTINGS,
  MAX_REPOS,
  METHODS,
  SOFT_REFRESH_MS,
  TOPICS,
  effectiveMinutes,
  normalizeSettings,
  parseRepo,
  queryKey,
  sameRepo,
  visibleItems,
  type AddRepoResult,
  type IssueItem,
  type IssuesSettings,
  type IssuesState,
  type RepoError,
} from "./model.ts";
import { hostText } from "./text.ts";

export const name = "@fuyu/github-issues";
export const inject = ["clients", "commands", "messages/v1"];

const CONFIG_FILE = "config.json";
const ANONYMOUS_BUDGET_PER_HOUR = 50;

interface CachedRepo {
  key: string;
  items: IssueItem[];
  more: boolean;
  etag: string | null;
  error: RepoError | null;
  loaded: boolean;
  maxNumber: number;
}

function loadSettings(dir: string): IssuesSettings {
  try {
    const file = join(dir, CONFIG_FILE);
    if (!existsSync(file)) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(dir: string, settings: IssuesSettings): void {
  mkdirSync(dir, { recursive: true });
  const body = { ...settings, reposText: settings.repos.join(", ") };
  writeFileSync(join(dir, CONFIG_FILE), `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

function isRateLimited(status: number, rate: RateInfo | null): boolean {
  return (status === 403 || status === 429) && Boolean(rate && rate.remaining <= 0);
}

export function apply(ctx: Context) {
  const messages = ctx.services.get(messagesV1);

  let settings = loadSettings(ctx.dataDir);
  const cache = new Map<string, CachedRepo>();
  let rate: RateInfo | null = null;
  let loading = false;
  let running: Promise<IssuesState> | null = null;
  let lastRefresh = 0;
  let stopTimer: (() => Promise<void>) | null = null;

  const rateExhausted = (): boolean => Boolean(rate && rate.remaining <= 0 && rate.resetUnix * 1000 > Date.now());
  const cacheKey = (repo: string) => repo.toLowerCase();

  const snapshot = (): IssuesState => ({
    settings,
    groups: settings.repos.map((repo) => {
      const entry = cache.get(cacheKey(repo));
      return {
        repo,
        items: entry ? visibleItems(entry.items, settings) : [],
        more: entry ? entry.more : false,
        error: entry ? entry.error : null,
        loaded: entry ? entry.loaded : false,
      };
    }),
    loading,
    at: Date.now(),
  });

  const publish = () => ctx.clients.publish(TOPICS.state, snapshot());

  const persist = () => saveSettings(ctx.dataDir, settings);

  function renameRepo(from: string, to: string): string {
    if (from === to) return from;
    const exists = settings.repos.some((repo) => repo !== from && sameRepo(repo, to));
    const repos = exists
      ? settings.repos.filter((repo) => repo !== from)
      : settings.repos.map((repo) => (repo === from ? to : repo));
    settings = { ...settings, repos };
    const entry = cache.get(cacheKey(from));
    cache.delete(cacheKey(from));
    if (entry && !exists) cache.set(cacheKey(to), entry);
    persist();
    return to;
  }

  async function notifyNew(repo: string, fresh: IssueItem[]) {
    if (!settings.notifyNew || fresh.length === 0) return;
    const text = hostText();
    const newest = fresh[0];
    await messages.notify({
      source: name,
      pluginId: name,
      title: text.newIssueTitle(repo),
      body: `#${newest.number} ${newest.title}`,
      durationMs: 8000,
    });
  }

  async function refreshRepo(repo: string): Promise<void> {
    const key = queryKey(settings);
    let entry = cache.get(cacheKey(repo));
    if (!entry || entry.key !== key) {
      entry = { key, items: [], more: false, etag: null, error: null, loaded: false, maxNumber: entry?.maxNumber ?? 0 };
      cache.set(cacheKey(repo), entry);
    }
    if (rateExhausted() && rate) {
      entry.error = { kind: "rate", resetUnix: rate.resetUnix };
      return;
    }
    try {
      const answer = await fetchRepoIssues(repo, settings.sort, settings.labels, entry.etag);
      if (answer.rate) rate = answer.rate;
      let current = repo;
      if (answer.moved) {
        let target = answer.movedTo;
        if (!target) {
          const info = await fetchRepoInfo(repo);
          if (info.rate) rate = info.rate;
          target = info.fullName;
        }
        if (target && parseRepo(target)) current = renameRepo(repo, target);
      }
      if (answer.status === 304) {
        entry.error = null;
        return;
      }
      if (answer.status === 200 && answer.items) {
        const shown = visibleItems(answer.items, settings);
        const fresh = entry.maxNumber > 0 ? shown.filter((item) => item.number > entry.maxNumber) : [];
        entry.items = answer.items;
        entry.more = answer.more;
        entry.etag = answer.etag;
        entry.error = null;
        entry.loaded = true;
        for (const item of answer.items) entry.maxNumber = Math.max(entry.maxNumber, item.number);
        await notifyNew(current, fresh);
        return;
      }
      if (answer.status === 404) {
        entry.items = [];
        entry.error = { kind: "notFound" };
        return;
      }
      if (isRateLimited(answer.status, rate) && rate) {
        entry.error = { kind: "rate", resetUnix: rate.resetUnix };
        return;
      }
      entry.error = { kind: "failed", message: answer.errorMessage ?? `HTTP ${answer.status}` };
    } catch (error) {
      entry.error = { kind: "failed", message: error instanceof Error ? error.message : String(error) };
    }
  }

  async function runRefresh(): Promise<IssuesState> {
    const keep = new Set(settings.repos.map(cacheKey));
    for (const key of [...cache.keys()]) {
      if (!keep.has(key)) cache.delete(key);
    }
    if (settings.repos.length === 0) {
      loading = false;
      publish();
      return snapshot();
    }
    loading = true;
    publish();
    try {
      for (const repo of [...settings.repos]) {
        await refreshRepo(repo);
      }
      lastRefresh = Date.now();
    } finally {
      loading = false;
      publish();
    }
    return snapshot();
  }

  function refreshAll(soft = false): Promise<IssuesState> {
    if (running) return running;
    if (soft && Date.now() - lastRefresh < SOFT_REFRESH_MS) return Promise.resolve(snapshot());
    running = runRefresh().finally(() => {
      running = null;
    });
    return running;
  }

  function syncSchedule() {
    if (stopTimer) {
      void stopTimer();
      stopTimer = null;
    }
    if (settings.repos.length === 0) return;
    stopTimer = ctx.setInterval(() => {
      void refreshAll();
    }, effectiveMinutes(settings, ANONYMOUS_BUDGET_PER_HOUR) * 60_000);
  }

  syncSchedule();
  if (settings.repos.length > 0) void refreshAll();

  ctx.clients.handle(METHODS.getState, async () => snapshot());

  ctx.clients.handle(METHODS.setSettings, async (params?: unknown) => {
    const patch = params && typeof params === "object" ? { ...(params as Record<string, unknown>) } : {};
    delete patch.repos;
    delete patch.reposText;
    const before = settings;
    settings = normalizeSettings({ ...settings, ...patch }, settings);
    persist();
    if (settings.refreshMinutes !== before.refreshMinutes) syncSchedule();
    if (queryKey(settings) !== queryKey(before)) return refreshAll();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.addRepo, async (params?: { repo?: unknown }): Promise<AddRepoResult> => {
    const parsed = typeof params?.repo === "string" ? parseRepo(params.repo) : null;
    if (!parsed) return { ok: false, reason: "format" };
    if (settings.repos.some((repo) => sameRepo(repo, parsed))) return { ok: false, reason: "duplicate" };
    if (settings.repos.length >= MAX_REPOS) return { ok: false, reason: "full" };
    let info;
    try {
      info = await fetchRepoInfo(parsed);
    } catch (error) {
      return { ok: false, reason: "failed", message: error instanceof Error ? error.message : String(error) };
    }
    if (info.rate) rate = info.rate;
    if (info.status === 404) return { ok: false, reason: "notFound" };
    if (isRateLimited(info.status, rate)) return { ok: false, reason: "rate" };
    if (info.status !== 200) return { ok: false, reason: "failed", message: info.errorMessage ?? `HTTP ${info.status}` };
    const repo = info.fullName && parseRepo(info.fullName) ? info.fullName : parsed;
    if (settings.repos.some((item) => sameRepo(item, repo))) return { ok: false, reason: "duplicate" };
    settings = { ...settings, repos: [...settings.repos, repo] };
    persist();
    syncSchedule();
    publish();
    void (async () => {
      await refreshRepo(repo);
      publish();
    })();
    return { ok: true, repo };
  });

  ctx.clients.handle(METHODS.removeRepo, async (params?: { repo?: unknown }) => {
    const target = typeof params?.repo === "string" ? params.repo : "";
    settings = { ...settings, repos: settings.repos.filter((repo) => repo !== target) };
    cache.delete(cacheKey(target));
    persist();
    syncSchedule();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.refresh, async (params?: { soft?: unknown }) => refreshAll(params?.soft === true));

  ctx.commands.register("refresh", () => refreshAll(), {
    title: { "zh-CN": "立即刷新", en: "Refresh now" },
  });
}
