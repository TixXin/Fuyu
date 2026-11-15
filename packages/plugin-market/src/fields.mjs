export const LANGUAGES = ["zh-CN", "en"];

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const GITHUB_REPOSITORY = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]+)$/;

export const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const isTime = (value) => typeof value === "string" && TIME.test(value) && Number.isFinite(Date.parse(value));

export const timeOf = (value) => (isTime(value) ? Date.parse(value) : Number.NaN);

export const isText = (value) => typeof value === "string" && value.trim() !== "";

export const isLocalized = (value) => isObject(value) && LANGUAGES.every((language) => isText(value[language]));

export const isTextArray = (value) => Array.isArray(value) && value.every(isText);

export const isHex = (value, length) => typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);

export const isCount = (value) => Number.isSafeInteger(value) && value >= 0;

export function isHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "" && url.href === value;
  } catch {
    return false;
  }
}

export function githubOwner(repository) {
  if (typeof repository !== "string") return null;
  const match = GITHUB_REPOSITORY.exec(repository);
  if (!match || match[2].endsWith(".git") || match[2] === "." || match[2] === "..") return null;
  return match[1];
}

export function problems() {
  const list = [];
  return {
    list,
    add: (path, message) => list.push({ path, message }),
    check(ok, path, message) {
      if (!ok) list.push({ path, message });
      return ok;
    },
  };
}

export function checkUnique(report, items, keyOf, path, what) {
  const seen = new Set();
  items.forEach((item, i) => {
    const key = keyOf(item);
    if (key === undefined) return;
    if (seen.has(key)) report.add(`${path}[${i}]`, `duplicate ${what} ${JSON.stringify(key)}`);
    seen.add(key);
  });
}
