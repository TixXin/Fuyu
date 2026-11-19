import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emptyRevocations } from "../../../../packages/plugin-market/src/index.mjs";
import { normalizeAutoUpdated } from "./marketAutoUpdated.mjs";

export const STATE_FILE = "market-state.json";

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export function normalizeTrustedAuthors(raw) {
  if (!isObject(raw)) return {};
  const out = {};
  for (const [name, pin] of Object.entries(raw)) {
    if (!isObject(pin) || typeof pin.repository !== "string" || !pin.repository) continue;
    out[name] = { keyId: typeof pin.keyId === "string" && pin.keyId ? pin.keyId : null, repository: pin.repository };
  }
  return out;
}

export function normalizeLastSource(raw) {
  return isObject(raw) && typeof raw.name === "string" && raw.name && typeof raw.at === "number" ? { name: raw.name, at: raw.at } : null;
}

export function readState(dataDir) {
  const statePath = join(dataDir, STATE_FILE);
  const empty = () => ({ manualAllowed: false, lastIndexSerial: null, revocations: emptyRevocations(), trustedAuthors: {}, updatedAt: null, lastError: null, revocationWarning: null, lastSource: null, autoUpdated: null });
  if (!existsSync(statePath)) return empty();
  try {
    const raw = JSON.parse(readFileSync(statePath, "utf8"));
    return {
      manualAllowed: raw?.manualAllowed === true,
      lastIndexSerial: Number.isSafeInteger(raw?.lastIndexSerial) ? raw.lastIndexSerial : null,
      revocations: isObject(raw?.revocations) && Array.isArray(raw.revocations.entries) ? raw.revocations : emptyRevocations(),
      trustedAuthors: normalizeTrustedAuthors(raw?.trustedAuthors),
      updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : null,
      lastError: typeof raw?.lastError === "string" ? raw.lastError : null,
      revocationWarning: typeof raw?.revocationWarning === "string" ? raw.revocationWarning : null,
      lastSource: normalizeLastSource(raw?.lastSource),
      autoUpdated: normalizeAutoUpdated(raw?.autoUpdated),
    };
  } catch {
    return empty();
  }
}

export function writeState(dataDir, state) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
