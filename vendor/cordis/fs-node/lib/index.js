var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { BaseFs } from "@cordisjs/fs";
import { resolve as resolve2 } from "node:path";
import { fileURLToPath } from "node:url";

// src/watcher.ts
import { watch } from "chokidar";
import { statSync } from "node:fs";
import { dirname, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import picomatch from "picomatch";
function contains(base, path) {
  return !base || path === base || path.startsWith(base + "/");
}
__name(contains, "contains");
function matchesUpward(match, path) {
  for (let end = path.length; end > 0; end = path.lastIndexOf("/", end - 1)) {
    if (match(path.slice(0, end))) return true;
  }
  return false;
}
__name(matchesUpward, "matchesUpward");
function toPredicate(filter) {
  if (typeof filter === "function") return filter;
  const rules = filter.map((entry) => {
    const negated = entry.startsWith("!");
    const pattern = posix.normalize(negated ? entry.slice(1) : entry).replace(/\/$/, "");
    if (posix.isAbsolute(pattern) || pattern.split("/").includes("..")) {
      throw new TypeError(`filter entry ${JSON.stringify(entry)} leads outside the watched directory`);
    }
    const { base } = picomatch.scan(pattern, { unescape: true });
    return {
      negated,
      // `.` is the watched directory, which no path below it matches.
      // `posix` makes `[!...]` a negated bracket expression, as in POSIX.
      match: pattern === "." ? () => true : picomatch(pattern, { posix: true }),
      base: base === "." ? "" : base,
      upward: true
    };
  });
  for (let index = rules.length - 1; index >= 0 && rules[index].negated; index--) {
    rules[index].upward = false;
  }
  return (path, isDirectory) => {
    let index = rules.length;
    while (index--) {
      const { match, upward } = rules[index];
      if (upward ? matchesUpward(match, path) : match(path)) break;
    }
    if (index >= 0 && !rules[index].negated) return true;
    return isDirectory && rules.some(({ negated, base }, i) => {
      return i > index && !negated && (contains(base, path) || contains(path, base));
    });
  };
}
__name(toPredicate, "toPredicate");
function watchPath(watcher, filename) {
  const keep = watcher.options.filter && toPredicate(watcher.options.filter);
  const isFile = !statSync(filename, { throwIfNoEntry: false })?.isDirectory();
  const root = isFile ? dirname(filename) : filename;
  const instance = watch(root, {
    ignoreInitial: true,
    depth: isFile ? 0 : void 0,
    // chokidar also tests the root itself
    ignored: /* @__PURE__ */ __name((path, stats) => {
      path = resolve(path);
      if (path === root) return false;
      if (isFile) return path !== filename;
      if (!keep) return false;
      if (!stats || stats.isSymbolicLink()) return false;
      return !keep(relative(root, path).split(sep).join("/"), stats.isDirectory());
    }, "ignored")
  });
  instance.on("error", (error) => watcher.emit("error", error));
  instance.on("change", (path) => watcher.emit("change", pathToFileURL(resolve(path))));
  instance.once("ready", () => watcher.emit("ready"));
  return () => instance.close();
}
__name(watchPath, "watchPath");

// src/index.ts
var driveRelative = /^[a-zA-Z]:(?![\\/])/;
function toPath(url) {
  const filename = fileURLToPath(url);
  if (process.platform === "win32" && driveRelative.test(filename)) {
    throw new TypeError(
      `expected an absolute path, got the drive-relative form ${JSON.stringify(filename)} from ${JSON.stringify(url.href)}`
    );
  }
  return resolve2(filename);
}
__name(toPath, "toPath");
var NodeFs = class extends BaseFs {
  static {
    __name(this, "NodeFs");
  }
  static mount = "file:";
  watch(watcher) {
    return watchPath(watcher, toPath(watcher.url));
  }
};
var index_default = NodeFs;
export {
  index_default as default
};
