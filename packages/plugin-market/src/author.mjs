import { signText, verifyText } from "./keys.mjs";

export const COMMIT_DOMAIN = "fuyu-plugin-commit/1";
export const KEY_DOMAIN = "fuyu-plugin-key/1";

const FIELDS = ["name", "version", "repository", "commit"];

export function commitText(fields) {
  for (const field of FIELDS) {
    const value = fields?.[field];
    if (typeof value !== "string" || value === "" || /[\r\n]/.test(value)) {
      throw new TypeError(`The signed commit needs a one-line ${field}`);
    }
  }
  return [COMMIT_DOMAIN, ...FIELDS.map((field) => fields[field])].join("\n");
}

export const signCommit = (fields, privateKey) => signText(commitText(fields), privateKey);

export function verifyCommit(fields, signature, keys) {
  try {
    return verifyText(commitText(fields), signature, keys);
  } catch {
    return null;
  }
}

export const endorsementText = (name, key) => `${KEY_DOMAIN}\n${name}\n${key.keyId}\n${key.publicKey}`;

export function endorseKey(name, newKey, oldPrivateKey) {
  const { keyId, signature } = signText(endorsementText(name, newKey), oldPrivateKey);
  return { keyId: newKey.keyId, publicKey: newKey.publicKey, endorsedBy: { keyId, signature } };
}

export function verifyEndorsement(name, key, keys) {
  if (!key?.endorsedBy) return null;
  return verifyText(endorsementText(name, key), key.endorsedBy, keys);
}

export function verifyVersionSignature(plugin, entry) {
  if (!entry?.authorSignature) return null;
  const fields = { name: plugin?.name, version: entry.version, repository: entry.repository, commit: entry.commit };
  return verifyCommit(fields, entry.authorSignature, plugin?.authorKeys ?? []);
}

function endorsedByPinned(name, keyId, keys, pinned) {
  const seen = new Set();
  let current = keys.find((key) => key.keyId === keyId);
  while (current && !seen.has(current.keyId)) {
    seen.add(current.keyId);
    const parentId = verifyEndorsement(name, current, keys);
    if (!parentId) return false;
    if (pinned.includes(parentId)) return true;
    current = keys.find((key) => key.keyId === parentId);
  }
  return false;
}

const RESULT = {
  official: { install: true, autoUpdate: true, confirm: "none" },
  first: { install: true, autoUpdate: true, confirm: "none" },
  same: { install: true, autoUpdate: true, confirm: "none" },
  rotated: { install: true, autoUpdate: false, confirm: "once" },
  changed: { install: true, autoUpdate: false, confirm: "twice" },
  "bad-signature": { install: false, autoUpdate: false, confirm: "none" },
};

const result = (status, extra) => ({ status, ...RESULT[status], ...extra });

export function checkAuthor({ plugin, entry, pin = null }) {
  const repository = entry?.repository;
  const repositoryChanged = Boolean(pin) && pin.repository !== repository;
  if (plugin?.publisher?.official === true) {
    return result(repositoryChanged ? "changed" : "official", { signedBy: null, pin: { keyIds: [], repository } });
  }
  const signedBy = verifyVersionSignature(plugin, entry);
  if (!signedBy) return result("bad-signature", { signedBy: null, pin });
  const next = { keyIds: [signedBy], repository };
  if (!pin) return result("first", { signedBy, pin: next });
  const pinned = Array.isArray(pin.keyIds) ? pin.keyIds : [];
  if (!repositoryChanged && pinned.includes(signedBy)) return result("same", { signedBy, pin });
  if (!repositoryChanged && endorsedByPinned(plugin.name, signedBy, plugin.authorKeys ?? [], pinned)) {
    return result("rotated", { signedBy, pin: next });
  }
  return result("changed", { signedBy, pin: next });
}
