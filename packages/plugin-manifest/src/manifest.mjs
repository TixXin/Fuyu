import { checkPluginName, parseRepository } from "./names.mjs";
import { isValidRange, isValidVersion, satisfies } from "./semver.mjs";

export const DEFAULT_APP_KEY = "fuyu";
export const DEFAULT_OFFICIAL_SCOPE = "fuyu";
export const MANIFEST_VERSION = 1;
export const REQUIRED_LOCALES = ["zh-CN", "en"];
export const DEFAULT_CATEGORIES = ["productivity", "todos", "developer", "media", "messages", "information", "utilities"];
export const PLATFORMS = ["windows", "macos", "linux"];
export const MAX_SCREENSHOTS = 6;
export const GENERATED_FIELDS = ["nodeApis", "builtWith"];

export const NPM_FIELDS = [
  "name", "version", "type", "description", "author", "contributors", "maintainers", "license", "homepage", "repository", "bugs",
  "funding", "keywords", "files", "engines", "private", "main", "module", "exports", "imports", "types", "typings", "scripts",
  "dependencies", "devDependencies", "peerDependencies", "peerDependenciesMeta", "optionalDependencies", "bundleDependencies",
  "bundledDependencies", "overrides", "packageManager", "publishConfig", "sideEffects", "workspaces", "os", "cpu", "browser",
  "directories", "man", "bin", "config", "$schema",
];

export const APP_FIELDS = [
  "manifest", "displayName", "description", "icon", "categories", "screenshots", "preview", "platforms", "host", "client", "inject",
  "requires", "provides", "replaces", "slots", "commands", "network", "config", "experimental", "nodeApis", "builtWith",
];

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value.trim() !== "";
const HOSTNAME = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$|^localhost$/;
const SPEC = /^[A-Za-z0-9@][A-Za-z0-9@._/:-]*$/;

export function isSafeRelativePath(path) {
  if (!isText(path) || path.includes("\\") || path.includes("\0") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) return false;
  return path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function createChecker() {
  const errors = [];
  const warnings = [];
  const error = (path, code, message) => errors.push({ path, code, message });
  const warn = (path, code, message) => warnings.push({ path, code, message });
  const unknown = (object, known, prefix) => {
    for (const key of Object.keys(object)) if (!known.includes(key)) warn(`${prefix}${key}`, "unknown", `${prefix}${key} is not a known field and is ignored`);
  };
  const localized = (value, path, required) => {
    if (value === undefined) {
      if (required) error(path, "required", `${path} is required`);
      return;
    }
    if (!isObject(value)) return error(path, "localized", `${path} must map languages to text, e.g. { "zh-CN": "…", "en": "…" }`);
    for (const locale of REQUIRED_LOCALES) if (!isText(value[locale])) error(`${path}.${locale}`, "required", `${path} needs "${locale}" text`);
    for (const [locale, text] of Object.entries(value)) if (typeof text !== "string") error(`${path}.${locale}`, "type", `${path}.${locale} must be text`);
  };
  const strings = (value, path, test = isText, what = "non-empty text") => {
    if (value === undefined) return;
    if (!Array.isArray(value)) return error(path, "type", `${path} must be a list`);
    value.forEach((item, index) => {
      if (!test(item)) error(`${path}[${index}]`, "type", `${path}[${index}] must be ${what}`);
    });
    const seen = new Set();
    for (const item of value) {
      if (seen.has(item)) warn(path, "duplicate", `${path} lists "${item}" more than once`);
      seen.add(item);
    }
  };
  const file = (value, path, required, extensions) => {
    if (value === undefined) {
      if (required) error(path, "required", `${path} is required`);
      return;
    }
    if (!isSafeRelativePath(value)) return error(path, "path", `${path} must be a relative path inside the package, with "/" and no ".."`);
    if (extensions && !extensions.some((extension) => value.toLowerCase().endsWith(extension))) {
      error(path, "path", `${path} must end with ${extensions.join(" or ")}`);
    }
  };
  return { errors, warnings, error, warn, unknown, localized, strings, file };
}

function checkPackage(pkg, check, options) {
  const { error, unknown, strings } = check;
  const appKey = options.appKey;
  if (!isText(pkg.name)) error("name", "required", "name is required");
  else {
    const problem = checkPluginName(pkg.name, pkg.repository, options);
    if (problem) error("name", problem.code, problem.message);
  }
  if (!isText(pkg.version)) error("version", "required", "version is required");
  else if (!isValidVersion(pkg.version) || pkg.version.startsWith("v")) error("version", "semver", `version "${pkg.version}" is not semver (e.g. 1.2.0)`);
  if (pkg.type !== "module") error("type", "module", 'type must be "module"');
  if (!isText(pkg.license)) error("license", "required", "license is required (an SPDX id such as MIT)");
  else if (pkg.license.trim().toUpperCase() === "UNLICENSED") error("license", "license", "plugins must be open source: UNLICENSED is not accepted");
  if (pkg.repository === undefined) error("repository", "required", 'repository is required (e.g. "github:owner/name")');
  else if (!parseRepository(pkg.repository)) error("repository", "repository", "repository must name a source repository, e.g. github:owner/name");
  if (!isObject(pkg.engines) || pkg.engines[appKey] === undefined) error(`engines.${appKey}`, "required", `engines.${appKey} is required`);
  else if (!isText(pkg.engines[appKey]) || !isValidRange(pkg.engines[appKey])) {
    error(`engines.${appKey}`, "range", `engines.${appKey} must be a semver range such as ">=0.4.0"`);
  } else if (options.appVersion !== undefined && !satisfies(options.appVersion, pkg.engines[appKey], { includePrerelease: true })) {
    error(`engines.${appKey}`, "engine", `needs ${appKey} ${pkg.engines[appKey]}, this is ${options.appVersion}`);
  }
  if (pkg.description !== undefined && typeof pkg.description !== "string") error("description", "type", "description must be text");
  if (pkg.homepage !== undefined && !isText(pkg.homepage)) error("homepage", "type", "homepage must be a URL");
  strings(pkg.keywords, "keywords");
  strings(pkg.files, "files");
  unknown(pkg, [...NPM_FIELDS, appKey], "");
}

function checkRequires(value, check) {
  if (value === undefined) return;
  if (!isObject(value)) return check.error("requires", "type", "requires must map plugin names to version ranges");
  for (const [name, range] of Object.entries(value)) {
    if (!/^@[^/]+\/[^/]+$/.test(name)) check.error(`requires.${name}`, "name", `requires.${name}: plugins are named @scope/name`);
    if (!isText(range) || !isValidRange(range)) check.error(`requires.${name}`, "range", `requires.${name} must be a semver range`);
  }
}

function checkCommands(value, path, check) {
  if (value === undefined) return;
  if (!Array.isArray(value)) return check.error(path, "type", `${path} must be a list`);
  const ids = new Set();
  value.forEach((command, index) => {
    const at = `${path}[${index}]`;
    if (!isObject(command)) return check.error(at, "type", `${at} must be an object`);
    if (!isText(command.id)) check.error(`${at}.id`, "required", `${at}.id is required`);
    else if (ids.has(command.id)) check.error(`${at}.id`, "duplicate", `command id "${command.id}" is used twice`);
    ids.add(command.id);
    check.localized(command.title, `${at}.title`, true);
    if (command.keybinding !== undefined && !isText(command.keybinding)) check.error(`${at}.keybinding`, "type", `${at}.keybinding must be text`);
    check.unknown(command, ["id", "title", "keybinding"], `${at}.`);
  });
}

function checkScreenshots(value, path, check) {
  if (value === undefined) return;
  if (!Array.isArray(value)) return check.error(path, "type", `${path} must be a list`);
  if (value.length > MAX_SCREENSHOTS) check.error(path, "too-many", `at most ${MAX_SCREENSHOTS} screenshots`);
  value.forEach((shot, index) => {
    const at = `${path}[${index}]`;
    if (!isObject(shot)) return check.error(at, "type", `${at} must be an object`);
    check.file(shot.path, `${at}.path`, true, [".png", ".jpg", ".jpeg", ".webp"]);
    check.localized(shot.caption, `${at}.caption`, false);
    check.unknown(shot, ["path", "caption"], `${at}.`);
  });
}

function checkApp(app, check, options) {
  const { error, warn, strings, file, localized } = check;
  const p = `${options.appKey}.`;
  if (app.manifest !== MANIFEST_VERSION) error(`${p}manifest`, "manifest", `${p}manifest must be ${MANIFEST_VERSION}`);
  localized(app.displayName, `${p}displayName`, true);
  localized(app.description, `${p}description`, true);
  file(app.icon, `${p}icon`, true, [".png", ".svg"]);
  if (!Array.isArray(app.categories) || app.categories.length === 0) error(`${p}categories`, "required", `${p}categories needs at least one category`);
  else strings(app.categories, `${p}categories`, (item) => options.categories.includes(item), `one of ${options.categories.join(", ")}`);
  checkScreenshots(app.screenshots, `${p}screenshots`, check);
  if (app.preview !== undefined && typeof app.preview !== "boolean") error(`${p}preview`, "type", `${p}preview must be true or false`);
  strings(app.platforms, `${p}platforms`, (item) => PLATFORMS.includes(item), `one of ${PLATFORMS.join(", ")}`);
  file(app.host, `${p}host`, false, [".js", ".mjs"]);
  if (app.client !== undefined) {
    if (!isObject(app.client)) error(`${p}client`, "type", `${p}client must map window names to entry files`);
    else for (const [window, entry] of Object.entries(app.client)) file(entry, `${p}client.${window}`, true, [".js", ".mjs"]);
  }
  if (app.inject !== undefined) {
    if (!isObject(app.inject)) error(`${p}inject`, "type", `${p}inject must be { required, optional }`);
    else {
      strings(app.inject.required, `${p}inject.required`);
      strings(app.inject.optional, `${p}inject.optional`);
      check.unknown(app.inject, ["required", "optional"], `${p}inject.`);
    }
  }
  checkRequires(app.requires, check);
  for (const key of ["provides", "replaces", "slots", "experimental"]) strings(app[key], `${p}${key}`);
  strings(app.network, `${p}network`, (item) => typeof item === "string" && HOSTNAME.test(item), "a lowercase host name such as api.example.com");
  checkCommands(app.commands, `${p}commands`, check);
  file(app.config, `${p}config`, false, [".json"]);
  if (Array.isArray(app.experimental) && app.experimental.length > 0 && !options.allowExperimental) {
    error(`${p}experimental`, "experimental", "plugins that use experimental interfaces only load in development mode or as built-in plugins");
  }
  strings(app.nodeApis, `${p}nodeApis`, (item) => typeof item === "string" && SPEC.test(item), "a Node module name");
  if (app.builtWith !== undefined && !isValidVersion(app.builtWith)) error(`${p}builtWith`, "semver", `${p}builtWith must be a version`);
  if (options.stage === "source") {
    for (const key of GENERATED_FIELDS) if (app[key] !== undefined) warn(`${p}${key}`, "generated", `${p}${key} is written by the build; the value here is replaced`);
  }
  check.unknown(app, APP_FIELDS, p);
}

export function validateManifest(pkg, options = {}) {
  const resolved = {
    appKey: options.appKey ?? DEFAULT_APP_KEY,
    officialScope: options.officialScope ?? DEFAULT_OFFICIAL_SCOPE,
    official: options.official ?? false,
    stage: options.stage ?? "built",
    appVersion: options.appVersion,
    allowExperimental: options.allowExperimental ?? true,
    categories: options.categories ?? DEFAULT_CATEGORIES,
  };
  const check = createChecker();
  if (!isObject(pkg)) {
    check.error("", "type", "package.json must be a JSON object");
    return { ok: false, errors: check.errors, warnings: check.warnings, manifest: null, app: null };
  }
  checkPackage(pkg, check, resolved);
  const app = pkg[resolved.appKey];
  if (!isObject(app)) check.error(resolved.appKey, "required", `${resolved.appKey} is required`);
  else checkApp(app, check, resolved);
  const ok = check.errors.length === 0;
  return { ok, errors: check.errors, warnings: check.warnings, manifest: ok ? pkg : null, app: ok ? app : null };
}
