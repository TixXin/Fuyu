import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { packDirectory, packageFileName, publicKeyOf, readPackage, sha256Hex, signPackage, validateManifest } from "@fuyu/plugin-manifest";
import { build } from "./build.mjs";
import { BuildError } from "./errors.mjs";

export const DEFAULT_PACK_DIR = "build";

export async function pack(dir, options = {}) {
  const result = await build(dir, options);
  const packed = packDirectory(result.outDir);
  let zip = packed.zip;
  let signedBy = null;
  if (options.signingKey) {
    zip = signPackage(zip, "author", options.signingKey);
    signedBy = publicKeyOf(options.signingKey).keyId;
  }
  const read = readPackage(zip);
  const check = validateManifest(read.manifest, { appKey: options.appKey, official: options.official, allowExperimental: options.allowExperimental, stage: "built" });
  if (!check.ok || read.digest !== packed.digest) throw new BuildError("the package does not read back cleanly", check.errors);
  const file = options.file ? resolve(options.file) : resolve(result.dir, options.packDir ?? DEFAULT_PACK_DIR, packageFileName(result.manifest.name, result.manifest.version));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, zip);
  return { ...result, file, digest: packed.digest, size: zip.length, sha256: sha256Hex(zip), signedBy };
}
