import { checkHeader, parseName } from "./index-format.mjs";
import { checkUnique, isLocalized, isObject, isText, problems } from "./fields.mjs";
import { isValidVersion } from "./semver.mjs";

export const LEVELS = ["warn", "disable"];

const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export function validateRevoked(doc) {
  const report = problems();
  if (!checkHeader(report, doc)) return report.list;
  if (report.check(Array.isArray(doc.entries), "entries", "must be a list")) {
    doc.entries.forEach((entry, i) => {
      const path = `entries[${i}]`;
      if (!report.check(isObject(entry), path, "must be an object")) return;
      report.check(ID.test(entry.id ?? ""), `${path}.id`, "must be a lowercase id");
      report.check(parseName(entry.name) !== null, `${path}.name`, "must be @<scope>/<name>");
      report.check(entry.version === "*" || isValidVersion(entry.version), `${path}.version`, 'must be a version or "*"');
      report.check(LEVELS.includes(entry.level), `${path}.level`, `must be ${LEVELS.join(" or ")}`);
      report.check(isLocalized(entry.reason), `${path}.reason`, "needs zh-CN and en");
    });
    checkUnique(report, doc.entries, (entry) => entry?.id, "entries", "id");
  }
  if (report.check(Array.isArray(doc.withdrawn), "withdrawn", "must be a list")) {
    const ids = new Set(Array.isArray(doc.entries) ? doc.entries.map((entry) => entry?.id) : []);
    doc.withdrawn.forEach((item, i) => {
      const path = `withdrawn[${i}]`;
      if (!report.check(isObject(item), path, "must be an object")) return;
      report.check(isText(item.id) && ids.has(item.id), `${path}.id`, "must name an entry in this list");
      report.check(isLocalized(item.reason), `${path}.reason`, "needs zh-CN and en");
    });
    checkUnique(report, doc.withdrawn, (item) => item?.id, "withdrawn", "id");
  }
  return report.list;
}

export const emptyRevocations = () => ({ serial: -1, entries: [], withdrawn: [] });

export function mergeRevoked(saved, incoming) {
  const state = saved ?? emptyRevocations();
  if (incoming.serial < state.serial) return { ok: false, reason: "older-serial", state };
  const entries = [...state.entries];
  const known = new Set(entries.map((entry) => entry.id));
  const added = [];
  for (const entry of incoming.entries) {
    if (known.has(entry.id)) continue;
    const { id, name, version, level, reason } = entry;
    entries.push({ id, name, version, level, reason });
    known.add(id);
    added.push(id);
  }
  const withdrawn = [...state.withdrawn];
  const gone = new Set(withdrawn.map((item) => item.id));
  const newlyWithdrawn = [];
  for (const item of incoming.withdrawn) {
    if (gone.has(item.id)) continue;
    withdrawn.push({ id: item.id, reason: item.reason });
    gone.add(item.id);
    newlyWithdrawn.push(item.id);
  }
  return {
    ok: true,
    state: { serial: Math.max(state.serial, incoming.serial), entries, withdrawn },
    added,
    withdrawn: newlyWithdrawn,
  };
}

export function activeRevocations(state) {
  const gone = new Set((state?.withdrawn ?? []).map((item) => item.id));
  return (state?.entries ?? []).filter((entry) => !gone.has(entry.id));
}

export function revocationOf(state, name, version) {
  const matches = activeRevocations(state).filter((entry) => entry.name === name && (entry.version === "*" || entry.version === version));
  if (matches.length === 0) return null;
  const level = matches.some((entry) => entry.level === "disable") ? "disable" : "warn";
  return { level, entries: matches };
}
