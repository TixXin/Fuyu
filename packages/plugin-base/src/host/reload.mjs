import { relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DATA_DIR } from "./data.mjs";

export const WATCHED = [".", "!**/node_modules", "!**/.*"];
export const DEV_WATCHED = [...WATCHED, `!${DATA_DIR}`];
const DEBOUNCE_MS = 30;

export function watchBuiltins(ctx, catalog) {
  const roots = (catalog?.plugins ?? []).map((plugin) => plugin.root);
  if (!roots.length) return;
  ctx.inject(["hmr", "fs"], (inner) => {
    const changed = new Set();
    let timer = null;
    let running = Promise.resolve();
    inner.effect(() => () => clearTimeout(timer), "built-in plugin reloads");
    const flush = async () => {
      const files = [...changed];
      changed.clear();
      try {
        const result = await inner.hmr.reconcile(() => files);
        for (const { urls, reason } of result.skipped) {
          inner.logger("hmr").warn(`skipped changes, which apply after a restart: ${urls.map((url) => `${url} (${reason})`).join(", ")}`);
        }
      } catch (error) {
        inner.logger("hmr").warn(error);
      }
    };
    for (const root of roots) {
      inner.fs.watch(pathToFileURL(root), { filter: WATCHED }).on("change", (url) => {
        const file = fileURLToPath(url);
        inner.logger("hmr").debug("change detected at %C", relative(root, file));
        changed.add(file);
        clearTimeout(timer);
        timer = setTimeout(() => (running = running.then(flush)), DEBOUNCE_MS);
      });
    }
  });
}
