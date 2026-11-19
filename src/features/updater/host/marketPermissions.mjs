export const PERMISSION_KEYS = Object.freeze(["nodeApis", "network", "replaces"]);

const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);

export function permissionsOf(manifest) {
  const source = typeof manifest === "object" && manifest !== null ? manifest : {};
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, strings(source[key])]));
}

export function addedPermissions(before, after) {
  const old = permissionsOf(before);
  const next = permissionsOf(after);
  const added = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, next[key].filter((item) => !old[key].includes(item))]));
  return PERMISSION_KEYS.some((key) => added[key].length > 0) ? added : null;
}
