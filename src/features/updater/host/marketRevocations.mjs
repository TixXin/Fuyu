import { mergeRevoked, openRevoked, revocationsBehind } from "../../../../packages/plugin-market/src/index.mjs";

export const REVOCATION_WARNINGS = Object.freeze(["network", "bad-signature", "bad-trust", "invalid", "older-serial", "expired", "behind"]);

async function fetchText(fetchImpl, url) {
  try {
    const res = await fetchImpl(url);
    if (res?.status === 404) return { missing: true };
    if (!res?.ok) return { failed: true };
    return { text: await res.text() };
  } catch {
    return { failed: true };
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function loadRevocations({ fetchImpl, revokedUrl, trust, saved, now }) {
  const list = await fetchText(fetchImpl, revokedUrl);
  if (list.missing) return { revocations: saved, updated: false, warning: null };
  if (list.failed) return { revocations: saved, updated: false, warning: "network" };
  const sig = await fetchText(fetchImpl, `${revokedUrl}.sig`);
  if (sig.failed) return { revocations: saved, updated: false, warning: "network" };
  const signature = sig.missing ? null : parseJson(sig.text);
  if (!signature) return { revocations: saved, updated: false, warning: "bad-signature" };
  const opened = openRevoked({
    text: list.text,
    signature,
    trust,
    lastSerial: (saved?.serial ?? -1) >= 0 ? saved.serial : undefined,
    now,
  });
  if (opened.status !== "ok" && opened.status !== "expired") {
    return { revocations: saved, updated: false, warning: opened.reason ?? "invalid" };
  }
  const merged = mergeRevoked(saved, opened.doc);
  if (!merged.ok) return { revocations: saved, updated: false, warning: merged.reason ?? "older-serial" };
  return { revocations: merged.state, updated: true, warning: opened.status === "expired" ? "expired" : null };
}

export async function refreshRevocations({ fetchImpl, revokedUrl, trust, saved, now, index }) {
  const result = await loadRevocations({ fetchImpl, revokedUrl, trust, saved, now });
  if (!result.warning && revocationsBehind(index, result.revocations)) return { ...result, warning: "behind" };
  return result;
}
