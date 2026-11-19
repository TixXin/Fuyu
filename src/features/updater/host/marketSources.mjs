export const DIRECT = "GitHub";
export const MIRROR_PREFIXES = Object.freeze(["https://ghfast.top/", "https://gh-proxy.com/"]);
export const PREFERRED_FOR_MS = 10 * 60 * 1000;

const GITHUB_HOSTS = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "codeload.github.com",
]);

function sourceError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function isGithubUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && GITHUB_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function sourcesFor(url) {
  const list = [{ name: DIRECT, prefix: "" }];
  if (isGithubUrl(url)) {
    for (const prefix of MIRROR_PREFIXES) list.push({ name: prefix.replace(/^https:\/\//, "").replace(/\/$/, ""), prefix });
  }
  return list;
}

export function createMarketDownloader({ fetchImpl, now = () => Date.now(), preferredForMs = PREFERRED_FOR_MS } = {}) {
  let preferred = null;
  let last = null;

  const ordered = (url) => {
    const list = sourcesFor(url);
    if (!preferred || now() - preferred.at > preferredForMs) return list;
    const first = list.find((source) => source.name === preferred.name);
    return first ? [first, ...list.filter((source) => source !== first)] : list;
  };

  const get = async (source, url, { timeoutMs, as = "text", maxBytes } = {}) => {
    const fail = (code, message) => Object.assign(sourceError(code, message), { source: source.name });
    if (typeof fetchImpl !== "function") throw fail("network", "no network access");
    const target = source.prefix && isGithubUrl(url) ? `${source.prefix}${url}` : url;
    const controller = new AbortController();
    const timer = typeof timeoutMs === "number" ? setTimeout(() => controller.abort(), timeoutMs) : null;
    timer?.unref?.();
    try {
      const res = await fetchImpl(target, { signal: controller.signal });
      if (res?.status === 404) return { missing: true };
      if (!res?.ok) throw fail("network", `answered ${res?.status ?? "nothing"}`);
      if (as === "bytes") {
        const bytes = Buffer.from(await res.arrayBuffer());
        if (typeof maxBytes === "number" && bytes.length > maxBytes) throw fail("too-large", `sent more than ${maxBytes} bytes`);
        return { missing: false, bytes };
      }
      return { missing: false, text: await res.text() };
    } catch (error) {
      if (error?.source === source.name) throw error;
      throw fail("network", controller.signal.aborted ? "timed out" : `could not be reached (${String(error?.message ?? error)})`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const run = async (url, attempt, what = "the file") => {
    const failures = [];
    for (const source of ordered(url)) {
      try {
        const value = await attempt({ name: source.name, get: (target, options) => get(source, target, options) });
        const at = now();
        preferred = { name: source.name, at };
        last = { name: source.name, at };
        return value;
      } catch (error) {
        failures.push({ source: source.name, error });
      }
    }
    const telling = failures.find((failure) => typeof failure.error?.code === "string" && failure.error.code !== "network") ?? failures[0];
    const tried = failures.map((failure) => failure.source);
    const summary = failures.map((failure) => `${failure.source}: ${String(failure.error?.message ?? failure.error)}`).join("; ");
    throw sourceError(typeof telling?.error?.code === "string" ? telling.error.code : "network", `Could not get ${what} (${summary})`, { ...(telling?.error?.data ?? {}), tried });
  };

  return { run, last: () => last };
}
