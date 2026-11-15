const VERSION = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const PARTIAL = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-.]+)?$/;

export function parseVersion(text) {
  const match = typeof text === "string" ? VERSION.exec(text.trim()) : null;
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ? match[4].split(".") : [] };
}

export const isValidVersion = (text) => parseVersion(text) !== null;

function comparePre(left, right) {
  if (!left.length || !right.length) return right.length - left.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const numA = /^\d+$/.test(a);
    const numB = /^\d+$/.test(b);
    if (numA && numB && Number(a) !== Number(b)) return Number(a) < Number(b) ? -1 : 1;
    if (numA !== numB) return numA ? -1 : 1;
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
}

export function compareVersions(left, right) {
  const a = typeof left === "string" ? parseVersion(left) : left;
  const b = typeof right === "string" ? parseVersion(right) : right;
  for (const key of ["major", "minor", "patch"]) if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  return comparePre(a.pre, b.pre);
}

const wild = (part) => part === undefined || /^[xX*]$/.test(part);

function partial(text) {
  const match = PARTIAL.exec(text);
  if (!match) return null;
  const [, major, minor, patch, pre] = match;
  if (wild(major)) return { any: true };
  const parts = [major, minor, patch];
  const known = parts.findIndex(wild);
  const length = known < 0 ? 3 : known;
  if (parts.slice(length).some((part) => !wild(part))) return null;
  if (pre && length < 3) return null;
  return { length, major: Number(major), minor: Number(minor) || 0, patch: Number(patch) || 0, pre: pre ? pre.split(".") : [] };
}

const at = (major, minor, patch, pre = []) => ({ major, minor, patch, pre });
const bound = (major, minor, patch) => ({ major, minor, patch, pre: ["0"], synthetic: true });
const next = (p) => (p.length === 1 ? bound(p.major + 1, 0, 0) : bound(p.major, p.minor + 1, 0));
const floor = (p) => at(p.major, p.minor, p.patch, p.pre);

function comparators(operator, text) {
  const p = partial(text);
  if (!p) return null;
  if (p.any) return operator === "<" || operator === ">" ? [{ op: "<", version: bound(0, 0, 0) }] : [];
  if (operator === "^") {
    const upper = p.major > 0 || p.length === 1 ? bound(p.major + 1, 0, 0) : p.minor > 0 || p.length === 2 ? bound(0, p.minor + 1, 0) : bound(0, 0, p.patch + 1);
    return [{ op: ">=", version: floor(p) }, { op: "<", version: upper }];
  }
  if (operator === "~") return [{ op: ">=", version: floor(p) }, { op: "<", version: p.length === 1 ? next(p) : bound(p.major, p.minor + 1, 0) }];
  if (p.length < 3) {
    if (operator === "" || operator === "=") return [{ op: ">=", version: floor(p) }, { op: "<", version: next(p) }];
    if (operator === ">") return [{ op: ">=", version: next(p) }];
    if (operator === "<=") return [{ op: "<", version: next(p) }];
  }
  return [{ op: operator || "=", version: floor(p) }];
}

function parseSet(text) {
  const hyphen = /^\s*(\S+)\s+-\s+(\S+)\s*$/.exec(text);
  if (hyphen) {
    const low = comparators(">=", hyphen[1]);
    const high = partial(hyphen[2]);
    if (!low || !high) return null;
    if (high.any) return low;
    return [...low, ...(high.length < 3 ? [{ op: "<", version: next(high) }] : [{ op: "<=", version: floor(high) }])];
  }
  const tokens = text.trim().replace(/(>=|<=|[<>=^~])\s+/g, "$1").split(/\s+/).filter(Boolean);
  const set = [];
  for (const token of tokens) {
    const match = /^(>=|<=|[<>=^~]|)(.*)$/.exec(token);
    const parsed = match && comparators(match[1], match[2]);
    if (!parsed) return null;
    set.push(...parsed);
  }
  return set;
}

export function parseRange(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  const sets = text.split("||").map(parseSet);
  return sets.some((set) => set === null) ? null : sets;
}

export const isValidRange = (text) => parseRange(text) !== null;

function test(comparator, version) {
  const order = compareVersions(version, comparator.version);
  return { "=": order === 0, ">": order > 0, ">=": order >= 0, "<": order < 0, "<=": order <= 0 }[comparator.op];
}

const sameTuple = (a, b) => a.major === b.major && a.minor === b.minor && a.patch === b.patch;

export function satisfies(versionText, rangeText) {
  const version = parseVersion(versionText);
  const range = parseRange(rangeText);
  if (!version || !range) return false;
  return range.some((set) => {
    if (!set.every((comparator) => test(comparator, version))) return false;
    if (!version.pre.length) return true;
    return set.some((comparator) => !comparator.version.synthetic && comparator.version.pre.length > 0 && sameTuple(comparator.version, version));
  });
}
