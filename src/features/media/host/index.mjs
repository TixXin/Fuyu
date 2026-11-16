import { mediaV1 } from "@fuyu/plugin-services";

export const name = "music";

const PASSED = new Set(["bad-params", "timeout", "peer-gone"]);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value) => (typeof value === "string" && value.length > 0 ? value : null);
const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function mediaError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function fromRust(error) {
  const reason = typeof error?.code === "string" ? error.code : "failed";
  const code = PASSED.has(reason) ? reason : reason === "inactive" ? "peer-gone" : "failed";
  const data = { reason };
  if (isObject(error?.data?.args)) data.args = error.data.args;
  if (typeof error?.data?.detail === "string") data.detail = error.data.detail;
  return mediaError(code, String(error?.message ?? error), data);
}

export function serviceNowPlaying(state) {
  const read = isObject(state) ? state : {};
  return {
    available: read.available === true,
    playing: typeof read.playing === "boolean" ? read.playing : read.playbackStatus === "playing",
    audible: typeof read.audible === "boolean" ? read.audible : read.audioActive === true,
    title: text(read.title),
    artist: text(read.artist),
    album: text(read.album),
    sourceApp: text(read.sourceApp),
    positionMs: number(read.positionMs),
    durationMs: number(read.durationMs),
    canSeek: read.canSeek === true,
    canNext: read.canNext === true,
    canPrevious: read.canPrevious === true,
    updatedAt: number(read.updatedAt),
  };
}

export function positionOf(params) {
  const position = isObject(params) && Object.keys(params).every((key) => key === "positionMs") ? params.positionMs : undefined;
  if (!Number.isSafeInteger(position) || position < 0) {
    throw mediaError("bad-params", "media/v1 seek takes { positionMs: number }, whole milliseconds from 0");
  }
  return position;
}

export function apply(ctx) {
  const call = (method, params) =>
    ctx.rust.call(`media.${method}`, params).catch((error) => {
      throw fromRust(error);
    });
  const answer = async (method, params) => serviceNowPlaying(await call(method, params));

  ctx.services.provide(mediaV1, {
    nowPlaying: () => answer("nowPlaying", null),
    playPause: () => answer("playPause", null),
    next: () => answer("next", null),
    previous: () => answer("previous", null),
    seek: (params) => answer("seek", { positionMs: positionOf(params) }),
  });
}
