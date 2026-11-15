export const DEFAULT_APP_KEY = "fuyu";
export const MANIFEST_VERSION = 1;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function validateManifest(pkg, options = {}) {
  const appKey = options.appKey ?? DEFAULT_APP_KEY;
  const errors = [];
  const warnings = [];
  const error = (path, code, message) => errors.push({ path, code, message });
  if (!isObject(pkg)) {
    error("", "type", "package.json must be a JSON object");
    return { ok: false, errors, warnings, manifest: null, app: null };
  }
  if (typeof pkg.name !== "string" || pkg.name === "") error("name", "required", "name is required");
  if (typeof pkg.version !== "string" || pkg.version === "") error("version", "required", "version is required");
  if (pkg.type !== "module") error("type", "module", 'type must be "module"');
  const app = pkg[appKey];
  if (!isObject(app)) error(appKey, "required", `${appKey} is required`);
  else if (app.manifest !== MANIFEST_VERSION) error(`${appKey}.manifest`, "manifest", `${appKey}.manifest must be ${MANIFEST_VERSION}`);
  const ok = errors.length === 0;
  return { ok, errors, warnings, manifest: ok ? pkg : null, app: ok ? app : null };
}
