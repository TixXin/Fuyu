import { createHash } from "node:crypto";
import { DOC_NAME } from "../../../../packages/plugin-market/src/index.mjs";
import { isObject, marketError } from "./marketStore.mjs";

export const REMOTE_DOC_TIMEOUT_MS = 4000;
export const MAX_DOC_BYTES = 1024 * 1024;

const SHA256 = /^[0-9a-f]{64}$/;

export function docHashes(versionEntry) {
  if (!isObject(versionEntry?.docs)) return null;
  const hashes = new Map();
  for (const [name, sha256] of Object.entries(versionEntry.docs)) {
    if (DOC_NAME.test(name) && typeof sha256 === "string" && SHA256.test(sha256)) hashes.set(name.toLowerCase(), { name, sha256 });
  }
  return hashes;
}

async function fetchVerifiedDoc(downloader, url, sha256) {
  try {
    return await downloader.run(url, async (source) => {
      const res = await source.get(url, { timeoutMs: REMOTE_DOC_TIMEOUT_MS, as: "bytes", maxBytes: MAX_DOC_BYTES });
      if (res.missing) throw marketError("missing", "the document is not there");
      if (createHash("sha256").update(res.bytes).digest("hex") !== sha256) throw marketError("bad-sha256", "the document does not match the SHA-256 in the index");
      return res.bytes.toString("utf8").replace(/^﻿/, "");
    }, "the document");
  } catch {
    return null;
  }
}

async function fetchDirectDoc(downloader, url) {
  try {
    return await downloader.run(url, async (source) => {
      const res = await source.get(url, { timeoutMs: REMOTE_DOC_TIMEOUT_MS });
      return res.missing ? null : res.text;
    }, "the document", { mirrors: false });
  } catch {
    return null;
  }
}

export async function fetchFirstRemoteDoc(downloader, rawBase, candidates, hashes = null) {
  if (!rawBase) return null;
  for (const filename of candidates) {
    const known = hashes?.get(filename.toLowerCase());
    if (hashes && !known) continue;
    const text = known
      ? await fetchVerifiedDoc(downloader, `${rawBase}${known.name}`, known.sha256)
      : await fetchDirectDoc(downloader, `${rawBase}${filename}`);
    if (text !== null) return text;
  }
  return null;
}
