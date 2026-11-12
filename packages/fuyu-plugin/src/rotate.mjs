import { existsSync, renameSync } from "node:fs";
import { endorseKey, generateSigningKey, keyEnvName, loadSigningKey, publicKeyOf } from "./sign.mjs";

export function rotateKey({ file, newFile, ids, env = process.env }) {
  if (ids.length === 0) throw new Error("Name the plugin ids the key signs.");
  const fromEnv = keyEnvName(env);
  if (fromEnv && !newFile) throw new Error(`The old key comes from ${fromEnv}; say where the new one goes with --new-key <file>.`);
  const oldKey = loadSigningKey({ file, env });
  const oldKeyId = publicKeyOf(oldKey).keyId;
  const target = newFile ?? file;
  let retiredFile = null;
  if (target === file && !fromEnv) {
    retiredFile = `${file}.${oldKeyId}.old`;
    if (existsSync(retiredFile)) throw new Error(`${retiredFile} already exists.`);
    renameSync(file, retiredFile);
  } else if (existsSync(target)) {
    throw new Error(`${target} already exists.`);
  }
  let newKey;
  try {
    newKey = generateSigningKey(target);
  } catch (error) {
    if (retiredFile) renameSync(retiredFile, file);
    throw error;
  }
  return { oldKeyId, retiredFile, newFile: target, endorsed: ids.map((id) => ({ id, key: endorseKey(id, newKey, oldKey) })) };
}
