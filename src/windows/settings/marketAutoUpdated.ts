const VERSION_HEADING = /^#{1,3}\s+\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\+[0-9A-Za-z.-]+)?\]?(?:\s.*)?$/;

function parseVersion(version: string): { core: number[]; pre: string[] } | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim());
  if (!match) return null;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ? match[4].split(".") : [] };
}

function comparePart(a: string, b: string): number {
  const numeric = /^\d+$/;
  if (numeric.test(a) && numeric.test(b)) return Number(a) - Number(b);
  if (numeric.test(a)) return -1;
  if (numeric.test(b)) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareReleaseVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i += 1) {
    if (left.core[i] !== right.core[i]) return left.core[i] - right.core[i];
  }
  if (left.pre.length === 0 || right.pre.length === 0) return right.pre.length - left.pre.length;
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i += 1) {
    if (left.pre[i] === undefined) return -1;
    if (right.pre[i] === undefined) return 1;
    const diff = comparePart(left.pre[i], right.pre[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function changelogBetween(changelog: string | null | undefined, from: string, to: string): string | null {
  if (typeof changelog !== "string" || !changelog.trim()) return null;
  const sections: { version: string; lines: string[] }[] = [];
  for (const line of changelog.replace(/\r\n/g, "\n").split("\n")) {
    const heading = VERSION_HEADING.exec(line.trim());
    if (heading) sections.push({ version: heading[1], lines: [line.trim()] });
    else sections[sections.length - 1]?.lines.push(line);
  }
  const wanted = sections.filter((section) => {
    const afterFrom = compareReleaseVersions(section.version, from);
    const upToTarget = compareReleaseVersions(section.version, to);
    return afterFrom !== null && upToTarget !== null && afterFrom > 0 && upToTarget <= 0;
  });
  const body = wanted.map((section) => section.lines.join("\n").trim()).join("\n\n").trim();
  return body || null;
}
