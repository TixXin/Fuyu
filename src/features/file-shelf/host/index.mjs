import { fileShelfV1 } from "@fuyu/plugin-services";

export const name = "file-shelf";

export const MAX_PATHS = 20;

const PASSED = new Set(["bad-params", "timeout", "peer-gone"]);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function shelfError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function fromRust(error) {
  const reason = typeof error?.code === "string" ? error.code : "failed";
  const code = PASSED.has(reason) ? reason : reason === "inactive" ? "peer-gone" : "failed";
  const data = { reason };
  if (isObject(error?.data?.args)) data.args = error.data.args;
  if (typeof error?.data?.detail === "string") data.detail = error.data.detail;
  return shelfError(code, String(error?.message ?? error), data);
}

export function pathsOf(params) {
  const paths = isObject(params) && Object.keys(params).every((key) => key === "paths") ? params.paths : undefined;
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > MAX_PATHS || paths.some((path) => typeof path !== "string" || path.length === 0)) {
    throw shelfError("bad-params", `file-shelf/v1 add takes { paths: string[] } with 1-${MAX_PATHS} paths`);
  }
  return paths;
}

function serviceItem(item) {
  return {
    id: String(item.id),
    path: String(item.path ?? ""),
    name: String(item.name ?? ""),
    isDir: item.isDir === true,
    size: number(item.size),
    addedAt: number(item.addedAt),
    pinned: item.pinned === true,
    missing: item.missing === true,
    unreachable: item.unreachable === true,
  };
}

export function serviceItems(snapshot) {
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  return { items: items.filter((item) => isObject(item) && typeof item.id === "string").map(serviceItem) };
}

export function apply(ctx) {
  const call = (method, params) =>
    ctx.rust.call(`fileShelf.${method}`, params).catch((error) => {
      throw fromRust(error);
    });

  ctx.services.provide(fileShelfV1, {
    list: async () => serviceItems(await call("list", null)),
    add: async (params) => serviceItems(await call("add", { paths: pathsOf(params) })),
  });
}
