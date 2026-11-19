import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isObject, marketError } from "./marketStore.mjs";

export const MEDIA_DIR = "media";
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
export const MEDIA_TIMEOUT_MS = 20 * 1000;

const MAX_PARALLEL = 4;
const MIME = Object.freeze({ svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" });
const SHA256 = /^[0-9a-f]{64}$/;

export function mediaMime(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return MIME[parsed.pathname.split(".").pop().toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

export function indexAssets(doc) {
  const assets = new Map();
  const add = (asset) => {
    if (isObject(asset) && typeof asset.url === "string" && typeof asset.sha256 === "string" && SHA256.test(asset.sha256) && mediaMime(asset.url)) {
      assets.set(asset.url, asset.sha256);
    }
  };
  for (const plugin of Array.isArray(doc?.plugins) ? doc.plugins : []) {
    for (const entry of Array.isArray(plugin?.versions) ? plugin.versions : []) {
      add(entry?.icon);
      for (const shot of Array.isArray(entry?.screenshots) ? entry.screenshots : []) add(shot);
    }
  }
  return assets;
}

export function createMarketMedia({ dataDir, downloader, readDoc }) {
  const dir = join(dataDir, MEDIA_DIR);
  const pending = new Map();
  const waiting = [];
  let active = 0;
  let assets = null;

  const known = () => {
    assets ??= indexAssets(readDoc());
    return assets;
  };

  const cached = (url, sha256) => {
    const file = join(dir, sha256);
    if (!existsSync(file)) return null;
    try {
      return `data:${mediaMime(url)};base64,${readFileSync(file).toString("base64")}`;
    } catch {
      return null;
    }
  };

  const download = async (url, sha256) => {
    if (active >= MAX_PARALLEL) await new Promise((resolve) => waiting.push(resolve));
    active += 1;
    try {
      const buf = await downloader.run(url, async (source) => {
        const res = await source.get(url, { timeoutMs: MEDIA_TIMEOUT_MS, as: "bytes", maxBytes: MAX_MEDIA_BYTES });
        if (res.missing) return null;
        if (res.bytes.length === 0) throw marketError("invalid", "the image is empty");
        if (createHash("sha256").update(res.bytes).digest("hex") !== sha256) throw marketError("bad-sha256", "the image does not match the SHA-256 in the index");
        return res.bytes;
      }, "the image");
      if (!buf) return false;
      mkdirSync(dir, { recursive: true });
      const temp = join(dir, `${sha256}.${process.pid}.tmp`);
      writeFileSync(temp, buf);
      renameSync(temp, join(dir, sha256));
      return true;
    } catch {
      return false;
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };

  const load = async (url, sha256) => {
    const hit = cached(url, sha256);
    if (hit) return hit;
    let job = pending.get(sha256);
    if (!job) {
      job = download(url, sha256).finally(() => pending.delete(sha256));
      pending.set(sha256, job);
    }
    return (await job) ? cached(url, sha256) : null;
  };

  const prune = () => {
    const keep = new Set(known().values());
    let names = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (keep.has(name) || pending.has(name.split(".")[0])) continue;
      try {
        rmSync(join(dir, name), { force: true });
      } catch {
        continue;
      }
    }
  };

  const warm = (urls) => Promise.all([...new Set(urls)].map((url) => {
    const sha256 = known().get(url);
    return sha256 && !existsSync(join(dir, sha256)) ? load(url, sha256) : null;
  }));

  return {
    get: async (params) => {
      if (!isObject(params) || typeof params.url !== "string" || !params.url) throw marketError("bad-params", "media expects { url }");
      const sha256 = known().get(params.url);
      return { url: params.url, data: sha256 ? await load(params.url, sha256) : null };
    },
    refreshed: (doc, plugins) => {
      assets = indexAssets(doc);
      prune();
      const urls = (Array.isArray(plugins) ? plugins : []).flatMap((plugin) => [plugin?.icon, plugin?.screenshots?.[0]?.url]).filter((url) => typeof url === "string");
      return warm(urls).catch(() => undefined);
    },
  };
}
