import { fileURLToPath } from "node:url";

function locations(ctx, name) {
  try {
    const url = new URL(name, ctx.baseUrl);
    if (url.protocol !== "file:") return null;
    const file = fileURLToPath(url);
    const dir = fileURLToPath(new URL(".", url));
    return { exact: [url.href, file], near: [new URL(".", url).href, dir] };
  } catch {
    return null;
  }
}

export function blame(ctx, error) {
  const stack = String(error?.stack ?? error ?? "");
  let near = null;
  for (const entry of ctx.loader.entries()) {
    const where = locations(ctx, entry.options.name);
    if (!where) continue;
    if (where.exact.some((place) => stack.includes(place))) return entry.options.id;
    if (!near && where.near.some((place) => place !== fileURLToPath(new URL(".", ctx.baseUrl)) && stack.includes(place))) near = entry.options.id;
  }
  return near;
}
