const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const QUERY_KEYS = new Set(["title", "artist", "album", "durationMs", "folder", "online", "chinese", "trackId"]);

export const BUILTIN_LYRICS_SOURCES = Object.freeze([
  Object.freeze({ id: "local", label: { zh: "本地 LRC 文件夹", en: "Local LRC Folder" }, builtin: true, order: 10 }),
  Object.freeze({ id: "kugou-local", label: { zh: "酷狗客户端缓存", en: "KuGou App Cache" }, builtin: true, order: 15 }),
  Object.freeze({ id: "netease", label: { zh: "网易云音乐", en: "NetEase Cloud Music" }, builtin: true, order: 20 }),
  Object.freeze({ id: "lrclib", label: { zh: "LRCLIB", en: "LRCLIB" }, builtin: true, order: 30 }),
  Object.freeze({ id: "kugou", label: { zh: "酷狗歌词", en: "KuGou Lyrics" }, builtin: true, order: 40 }),
  Object.freeze({ id: "qq", label: { zh: "QQ 音乐", en: "QQ Music" }, builtin: true, order: 45 }),
]);

function lyricsError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function lyricsQueryOf(params) {
  if (!isObject(params) || !Object.keys(params).every((key) => QUERY_KEYS.has(key))) {
    throw lyricsError("bad-params", "lyrics/v1 lookup takes { title, artist?, album?, durationMs?, folder?, online?, chinese?, trackId? }");
  }
  if (typeof params.title !== "string" || params.title.trim() === "") {
    throw lyricsError("bad-params", "lyrics/v1 lookup requires a non-empty string title");
  }
  return {
    title: params.title,
    artist: typeof params.artist === "string" ? params.artist : "",
    album: typeof params.album === "string" ? params.album : "",
    durationMs: typeof params.durationMs === "number" && Number.isFinite(params.durationMs) && params.durationMs >= 0 ? Math.floor(params.durationMs) : 0,
    folder: typeof params.folder === "string" ? params.folder : "",
    online: params.online !== false,
    chinese: params.chinese === true,
    trackId: typeof params.trackId === "string" && params.trackId.length > 0 ? params.trackId : null,
  };
}

export function normalizeLyricsResult(raw, fallbackSource = "custom") {
  if (!isObject(raw) || typeof raw.lrc !== "string" || raw.lrc.trim() === "") return null;
  const source = typeof raw.source === "string" && raw.source.trim() !== "" ? raw.source.trim() : fallbackSource;
  const translation = typeof raw.translation === "string" && raw.translation.trim() !== "" ? raw.translation : null;
  return translation ? { source, lrc: raw.lrc, translation } : { source, lrc: raw.lrc };
}

function validateSource(spec) {
  if (!isObject(spec) || typeof spec.id !== "string" || spec.id.trim() === "") {
    throw lyricsError("bad-params", "lyricsSources.register needs a non-empty string id");
  }
  if (typeof spec.lookup !== "function") {
    throw lyricsError("bad-params", `lyrics source ${spec.id} needs a lookup(query) function`);
  }
  const order = typeof spec.order === "number" && Number.isFinite(spec.order) ? spec.order : 100;
  return Object.freeze({
    id: spec.id.trim(),
    label: spec.label,
    order,
    beforeBuiltin: spec.beforeBuiltin === true || order < 50,
    lookup: spec.lookup,
  });
}

export function createLyricsSourceRegistry({ onChange } = {}) {
  const entries = new Map();
  const listeners = new Set();
  if (typeof onChange === "function") listeners.add(onChange);
  let snapshot = Object.freeze([...BUILTIN_LYRICS_SOURCES]);

  const rebuild = () => {
    const custom = [...entries.values()].map(({ spec }) =>
      Object.freeze({
        id: spec.id,
        ...(spec.label ? { label: spec.label } : {}),
        builtin: false,
        order: spec.order,
      }),
    );
    snapshot = Object.freeze(
      [...BUILTIN_LYRICS_SOURCES, ...custom].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    );
  };

  const notify = () => {
    rebuild();
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {}
    }
  };

  const orderedSpecs = () =>
    [...entries.values()]
      .sort((a, b) => a.spec.order - b.spec.order || a.spec.id.localeCompare(b.spec.id))
      .map((entry) => entry.spec);

  return Object.freeze({
    register(rawSpec) {
      const spec = validateSource(rawSpec);
      const token = Symbol(spec.id);
      entries.set(spec.id, { token, spec });
      notify();
      return () => {
        const current = entries.get(spec.id);
        if (!current || current.token !== token) return;
        entries.delete(spec.id);
        notify();
      };
    },
    sources() {
      return { sources: snapshot };
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async lookup(rawQuery, callBuiltin) {
      const query = lyricsQueryOf(rawQuery);
      const specs = orderedSpecs();
      for (const spec of specs.filter((item) => item.beforeBuiltin)) {
        try {
          const hit = normalizeLyricsResult(await spec.lookup(query), spec.id);
          if (hit) return hit;
        } catch {}
      }
      if (typeof callBuiltin === "function") {
        const builtinHit = normalizeLyricsResult(await callBuiltin(query), "local");
        if (builtinHit) return builtinHit;
      }
      for (const spec of specs.filter((item) => !item.beforeBuiltin)) {
        try {
          const hit = normalizeLyricsResult(await spec.lookup(query), spec.id);
          if (hit) return hit;
        } catch {}
      }
      return null;
    },
    clear() {
      if (entries.size === 0) return;
      entries.clear();
      notify();
    },
  });
}

const defaultRegistry = createLyricsSourceRegistry();

export function registerLyricsSource(spec) {
  return defaultRegistry.register(spec);
}

export function getLyricsSources() {
  return defaultRegistry.sources();
}

export function subscribeLyricsSources(listener) {
  return defaultRegistry.subscribe(listener);
}

export function lookupLyricsWithSources(query, callBuiltin) {
  return defaultRegistry.lookup(query, callBuiltin);
}

export function clearLyricsSourcesForTest() {
  defaultRegistry.clear();
}
