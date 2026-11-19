export const CAPABILITY_KEYS = Object.freeze(["nodeApis", "network", "replaces"]);

const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);

export function capabilitiesOf(manifest) {
  const source = typeof manifest === "object" && manifest !== null ? manifest : {};
  return Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, strings(source[key])]));
}

export function newCapabilities(before, after) {
  const old = capabilitiesOf(before);
  const next = capabilitiesOf(after);
  const added = Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, next[key].filter((item) => !old[key].includes(item))]));
  return CAPABILITY_KEYS.some((key) => added[key].length > 0) ? added : null;
}
