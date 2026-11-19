import { mergeRevoked, openRevoked, revocationsBehind } from "../../../../packages/plugin-market/src/index.mjs";

export const REVOKED_TIMEOUT_MS = 15 * 1000;
export const REVOCATION_WARNINGS = Object.freeze(["network", "bad-signature", "bad-trust", "invalid", "older-serial", "expired", "behind"]);

const rejected = (warning) => Object.assign(new Error(`Revocation list rejected: ${warning}`), { code: warning });

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function loadRevocations({ downloader, revokedUrl, trust, saved, now }) {
  try {
    return await downloader.run(revokedUrl, async (source) => {
      const list = await source.get(revokedUrl, { timeoutMs: REVOKED_TIMEOUT_MS });
      if (list.missing) return { revocations: saved, updated: false, warning: null };
      const sig = await source.get(`${revokedUrl}.sig`, { timeoutMs: REVOKED_TIMEOUT_MS });
      const signature = sig.missing ? null : parseJson(sig.text);
      if (!signature) throw rejected("bad-signature");
      const opened = openRevoked({
        text: list.text,
        signature,
        trust,
        lastSerial: (saved?.serial ?? -1) >= 0 ? saved.serial : undefined,
        now,
      });
      if (opened.status !== "ok" && opened.status !== "expired") throw rejected(opened.reason ?? "invalid");
      const merged = mergeRevoked(saved, opened.doc);
      if (!merged.ok) throw rejected(merged.reason ?? "older-serial");
      return { revocations: merged.state, updated: true, warning: opened.status === "expired" ? "expired" : null };
    }, "the revocation list");
  } catch (error) {
    return { revocations: saved, updated: false, warning: REVOCATION_WARNINGS.includes(error?.code) ? error.code : "invalid" };
  }
}

export async function refreshRevocations({ downloader, revokedUrl, trust, saved, now, index }) {
  const result = await loadRevocations({ downloader, revokedUrl, trust, saved, now });
  if (!result.warning && revocationsBehind(index, result.revocations)) return { ...result, warning: "behind" };
  return result;
}
