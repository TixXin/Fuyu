export const TEST_IDENTITY = Object.freeze({
  name: "Fuyu.LocalTest",
  publisher: "CN=FuyuLocalTest",
  publisherDisplayName: "Fuyu (local test)",
  storeProductId: "",
});

export function storeVersion(version, { allowPrerelease = false } = {}) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) throw new Error(`Cannot turn version "${version}" into a package version.`);
  const [, major, minor, patch, prerelease] = match;
  if (prerelease && !allowPrerelease) {
    throw new Error(`Version ${version} is a prerelease. The Store gets stable versions only; pass --allow-prerelease for a local test package.`);
  }
  for (const part of [major, minor, patch]) {
    if (Number(part) > 65535) throw new Error(`Version part ${part} of ${version} is above 65535.`);
  }
  return `${Number(major)}.${Number(minor)}.${Number(patch)}.0`;
}

export function resolveIdentity(stored, { testIdentity = false } = {}) {
  if (testIdentity) return { ...TEST_IDENTITY };
  const missing = ["name", "publisher", "publisherDisplayName"].filter((key) => typeof stored?.[key] !== "string" || stored[key].trim() === "");
  if (missing.length > 0) {
    throw new Error(`src-tauri/msix/store-identity.json is missing ${missing.join(", ")}. Fill it from Partner Center (Product identity), or pass --test-identity for a local test package.`);
  }
  if (!/^CN=/.test(stored.publisher)) throw new Error(`Publisher "${stored.publisher}" should start with CN=.`);
  return { name: stored.name.trim(), publisher: stored.publisher.trim(), publisherDisplayName: stored.publisherDisplayName.trim(), storeProductId: stored.storeProductId ?? "" };
}

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function fillManifest(template, identity, version) {
  const values = {
    NAME: identity.name,
    PUBLISHER: identity.publisher,
    PUBLISHER_DISPLAY_NAME: identity.publisherDisplayName,
    VERSION: version,
  };
  const filled = template.replace(/@([A-Z_]+)@/g, (whole, key) => {
    if (!(key in values)) throw new Error(`Unknown placeholder ${whole} in the manifest template.`);
    return escapeXml(values[key]);
  });
  return filled;
}

export function packageFileName(identity, version) {
  return `${identity.name}_${version}_x64.msix`;
}

export function sdkVersionsNewestFirst(versions) {
  return versions
    .filter((name) => /^10\.0\.\d+\.\d+$/.test(name))
    .sort((a, b) => {
      const left = a.split(".").map(Number);
      const right = b.split(".").map(Number);
      for (let index = 0; index < 4; index += 1) {
        if (left[index] !== right[index]) return right[index] - left[index];
      }
      return 0;
    });
}
