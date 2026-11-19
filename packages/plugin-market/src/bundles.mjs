import { checkUnique, isLocalized, isObject } from "./fields.mjs";

export const MIN_BUNDLE_PLUGINS = 2;
export const MAX_BUNDLE_PLUGINS = 6;

const BUNDLE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function checkBundle(report, bundle, path, { parseName, known }) {
  if (!report.check(isObject(bundle), path, "must be an object")) return;
  report.check(typeof bundle.id === "string" && BUNDLE_ID.test(bundle.id), `${path}.id`, "must be lowercase letters, digits and dashes, at most 64");
  report.check(isLocalized(bundle.displayName), `${path}.displayName`, "needs zh-CN and en");
  report.check(isLocalized(bundle.description), `${path}.description`, "needs zh-CN and en");
  if (bundle.onboarding !== undefined) report.check(typeof bundle.onboarding === "boolean", `${path}.onboarding`, "must be true or false");
  const members = bundle.plugins;
  const sized = Array.isArray(members) && members.length >= MIN_BUNDLE_PLUGINS && members.length <= MAX_BUNDLE_PLUGINS;
  if (!report.check(sized, `${path}.plugins`, `must list ${MIN_BUNDLE_PLUGINS} to ${MAX_BUNDLE_PLUGINS} plugin names`)) return;
  members.forEach((name, i) => {
    if (!report.check(parseName(name) !== null, `${path}.plugins[${i}]`, "must be @<scope>/<name> in lowercase")) return;
    report.check(known.has(name), `${path}.plugins[${i}]`, `${name} is not in this index`);
  });
  checkUnique(report, members, (name) => name, `${path}.plugins`, "plugin");
}

export function checkBundles(report, doc, parseName) {
  if (doc.bundles === undefined) return;
  if (!report.check(Array.isArray(doc.bundles), "bundles", "must be a list")) return;
  const known = new Set((Array.isArray(doc.plugins) ? doc.plugins : []).map((plugin) => plugin?.name));
  doc.bundles.forEach((bundle, i) => checkBundle(report, bundle, `bundles[${i}]`, { parseName, known }));
  checkUnique(report, doc.bundles, (bundle) => bundle?.id, "bundles", "id");
}
