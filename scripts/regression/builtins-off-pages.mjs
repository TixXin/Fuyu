import { readFileSync } from "node:fs";

const PAGE = "builtins-off.html";
const catalog = JSON.parse(readFileSync(new URL("../../src/features/builtins.json", import.meta.url), "utf8"));
const FEATURES = catalog.plugins.filter((plugin) => plugin.kind !== "essential");
const ROOTS = FEATURES.map(({ id, root }) => [id, `src/features/${root}/`]);

export const BUILTINS_OFF_PAGES = [`${PAGE}?self`, ...FEATURES.map(({ id }) => `${PAGE}?only=${id}`)];

export const isBuiltinsOffPage = (page) => BUILTINS_OFF_PAGES.includes(page);

export const featureOfFile = (file) => ROOTS.find(([, root]) => file.startsWith(root))?.[0] ?? null;

export function builtinsOffReached(page, files) {
  const feature = new URLSearchParams(page.split("?")[1] ?? "").get("only");
  return files.some((file) => {
    const owner = featureOfFile(file);
    return owner === null || owner === feature;
  });
}
