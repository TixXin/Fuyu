import { readFileSync } from "node:fs";
import path from "node:path";

export const TIMINGS_FILE = "tests/regression/timings.json";
const DEFAULT_SECONDS = 5;

const pageKey = (page) => page.split("?")[0];

export function readTimings(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, TIMINGS_FILE), "utf8")).seconds ?? {};
  } catch {
    return {};
  }
}

export function parseShard(text) {
  const match = /^(\d+)\/(\d+)$/.exec(text ?? "");
  if (!match) return null;
  const index = Number(match[1]);
  const count = Number(match[2]);
  return count >= 1 && index >= 1 && index <= count ? { index, count } : null;
}

export function parseJobs(text) {
  const jobs = Number(text);
  return Number.isInteger(jobs) && jobs >= 1 ? jobs : null;
}

export function pageWeights(pages, timings = {}) {
  const known = pages.map((page) => timings[pageKey(page)]).filter((seconds) => Number.isFinite(seconds)).sort((a, b) => a - b);
  const fallback = known.length ? known[Math.floor(known.length / 2)] : DEFAULT_SECONDS;
  return new Map(pages.map((page) => [page, Number.isFinite(timings[pageKey(page)]) ? timings[pageKey(page)] : fallback]));
}

export function slowestFirst(pages, timings = {}) {
  const weights = pageWeights(pages, timings);
  return pages.map((page, order) => ({ page, order })).sort((a, b) => weights.get(b.page) - weights.get(a.page) || a.order - b.order).map(({ page }) => page);
}

export function splitPages(pages, count, timings = {}) {
  const weights = pageWeights(pages, timings);
  const order = new Map(pages.map((page, index) => [page, index]));
  const bins = Array.from({ length: count }, () => ({ pages: [], total: 0 }));
  for (const page of slowestFirst(pages, timings)) {
    const bin = bins.reduce((lightest, next) => (next.total < lightest.total ? next : lightest));
    bin.pages.push(page);
    bin.total += weights.get(page);
  }
  return bins.map((bin) => bin.pages.sort((a, b) => order.get(a) - order.get(b)));
}

export function shardOf(pages, shard, timings = {}) {
  return shard ? splitPages(pages, shard.count, timings)[shard.index - 1] : pages;
}
