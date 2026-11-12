export function compareVersions(left: string, right: string): number {
  const split = (version: string) => {
    const [core = "", ...pre] = (version.split("+")[0] ?? "").trim().split("-");
    return { core: core.split(".").map((part) => Number.parseInt(part, 10) || 0), pre: pre.length > 0 ? pre.join("-") : null };
  };
  const a = split(left);
  const b = split(right);
  for (let index = 0; index < Math.max(a.core.length, b.core.length); index += 1) {
    const difference = (a.core[index] ?? 0) - (b.core[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (a.pre === b.pre) return 0;
  if (a.pre === null) return 1;
  if (b.pre === null) return -1;
  const left_ = a.pre.split(".");
  const right_ = b.pre.split(".");
  for (let index = 0; index < Math.min(left_.length, right_.length); index += 1) {
    const [x, y] = [left_[index], right_[index]];
    const [xNumber, yNumber] = [/^\d+$/.test(x) ? Number(x) : null, /^\d+$/.test(y) ? Number(y) : null];
    if (xNumber !== null && yNumber !== null) {
      if (xNumber !== yNumber) return Math.sign(xNumber - yNumber);
    } else if (xNumber !== null) return -1;
    else if (yNumber !== null) return 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return Math.sign(left_.length - right_.length);
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}
