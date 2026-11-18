const VERSION = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const PARTIAL = /^v?(\*|x|X|0|[1-9]\d*)(?:\.(\*|x|X|0|[1-9]\d*)(?:\.(\*|x|X|0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?)?)?$/;
const COMPARATOR = /^(<=|>=|<|>|=|\^|~)?\s*(.*)$/;

export function parseVersion(text) {
  if (typeof text !== "string") return null;
  const match = VERSION.exec(text.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)) : [],
  };
}

export const isValidVersion = (text) => parseVersion(text) !== null;

export const isPrerelease = (text) => (parseVersion(text)?.prerelease.length ?? 0) > 0;

function compareIdentifiers(a, b) {
  if (typeof a === "number" && typeof b === "number") return Math.sign(a - b);
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareParsed(a, b) {
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return Math.sign(a[key] - b[key]);
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return Math.sign(b.prerelease.length - a.prerelease.length);
  }
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i += 1) {
    if (i >= a.prerelease.length) return -1;
    if (i >= b.prerelease.length) return 1;
    const order = compareIdentifiers(a.prerelease[i], b.prerelease[i]);
    if (order !== 0) return order;
  }
  return 0;
}

function parseStrict(text) {
  const parsed = parseVersion(text);
  if (!parsed) throw new TypeError(`Not a semver version: ${JSON.stringify(text)}`);
  return parsed;
}

export const compareVersions = (a, b) => compareParsed(parseStrict(a), parseStrict(b));

const wild = (part) => part === undefined || part === "*" || part === "x" || part === "X";

const version = (major, minor, patch, prerelease = []) => ({ major, minor, patch, prerelease });

const floor = (major, minor, patch) => ({ ...version(major, minor, patch, [0]), synthetic: true });

function parsePartial(text) {
  const match = PARTIAL.exec(text);
  if (!match) return null;
  const [, major, minor, patch, pre] = match;
  const parts = [major, minor, patch].map((part) => (wild(part) ? null : Number(part)));
  if (parts[0] === null && (parts[1] !== null || parts[2] !== null)) return null;
  if (parts[1] === null && parts[2] !== null) return null;
  if (pre !== undefined && parts[2] === null) return null;
  const prerelease = pre ? (parseVersion(`0.0.0-${pre}`)?.prerelease ?? null) : [];
  if (prerelease === null) return null;
  return { major: parts[0], minor: parts[1], patch: parts[2], prerelease };
}

function exact(p) {
  return version(p.major ?? 0, p.minor ?? 0, p.patch ?? 0, p.prerelease);
}

function nextUp(p) {
  if (p.minor === null) return floor(p.major + 1, 0, 0);
  if (p.patch === null) return floor(p.major, p.minor + 1, 0);
  return null;
}

function desugar(operator, p) {
  if (p.major === null) return operator === "<" || operator === ">" ? [{ op: "never" }] : [];
  const low = exact(p);
  const up = nextUp(p);
  switch (operator) {
    case "^": {
      if (p.major > 0 || p.minor === null) return [{ op: ">=", v: low }, { op: "<", v: floor(p.major + 1, 0, 0) }];
      if (p.minor > 0 || p.patch === null) return [{ op: ">=", v: low }, { op: "<", v: floor(0, p.minor + 1, 0) }];
      return [{ op: ">=", v: low }, { op: "<", v: floor(0, 0, p.patch + 1) }];
    }
    case "~":
      return [{ op: ">=", v: low }, { op: "<", v: p.minor === null ? floor(p.major + 1, 0, 0) : floor(p.major, p.minor + 1, 0) }];
    case ">":
      return up ? [{ op: ">=", v: up }] : [{ op: ">", v: low }];
    case ">=":
      return [{ op: ">=", v: low }];
    case "<":
      return [{ op: "<", v: up ? floor(low.major, low.minor, low.patch) : low }];
    case "<=":
      return up ? [{ op: "<", v: up }] : [{ op: "<=", v: low }];
    default:
      return up ? [{ op: ">=", v: low }, { op: "<", v: up }] : [{ op: "=", v: low }];
  }
}

function parseSet(text) {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(text);
  if (hyphen) {
    const from = parsePartial(hyphen[1]);
    const to = parsePartial(hyphen[2]);
    if (!from || !to) return null;
    return [...desugar(">=", from), ...desugar("<=", to)];
  }
  const tokens = text.replace(/(<=|>=|<|>|=|\^|~)\s+/g, "$1").split(/\s+/).filter(Boolean);
  const comparators = [];
  for (const token of tokens) {
    const [, operator = "", rest] = COMPARATOR.exec(token) ?? [];
    const partial = parsePartial(rest ?? "");
    if (!partial) return null;
    comparators.push(...desugar(operator, partial));
  }
  return comparators;
}

export function parseRange(text) {
  if (typeof text !== "string") return null;
  const sets = [];
  for (const part of text.split("||")) {
    const set = parseSet(part.trim());
    if (!set) return null;
    sets.push(set);
  }
  return sets;
}

export const isValidRange = (text) => parseRange(text) !== null;

function test(comparator, v) {
  if (comparator.op === "never") return false;
  const order = compareParsed(v, comparator.v);
  switch (comparator.op) {
    case ">=":
      return order >= 0;
    case ">":
      return order > 0;
    case "<":
      return order < 0;
    case "<=":
      return order <= 0;
    default:
      return order === 0;
  }
}

const sameTuple = (a, b) => a.major === b.major && a.minor === b.minor && a.patch === b.patch;

export function satisfies(versionText, rangeText, options = {}) {
  const v = parseVersion(versionText);
  const sets = parseRange(rangeText);
  if (!v || !sets) return false;
  const includePrerelease = options?.includePrerelease === true;
  return sets.some((set) => {
    if (!set.every((comparator) => test(comparator, v))) return false;
    if (!v.prerelease.length || includePrerelease) return true;
    return set.some((comparator) => comparator.v && !comparator.v.synthetic && comparator.v.prerelease.length > 0 && sameTuple(comparator.v, v));
  });
}
