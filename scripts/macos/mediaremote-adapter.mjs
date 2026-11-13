import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ADAPTER = {
  version: "0.7.7",
  commit: "e3ff5021eb0875858bd05f48d2e9ba2e962d1cf6",
  sha256: "adf2564265cbfbed6ee967cd44f70f774a78f681aaa41145c67730cad66f9277",
};

const NAME = "MediaRemoteAdapter";
const SOURCES = [
  "src/adapter/env.m",
  "src/adapter/get.m",
  "src/adapter/globals.m",
  "src/adapter/keys.m",
  "src/adapter/now_playing.m",
  "src/adapter/repeat.m",
  "src/adapter/seek.m",
  "src/adapter/send.m",
  "src/adapter/shuffle.m",
  "src/adapter/speed.m",
  "src/adapter/stream.m",
  "src/adapter/test.m",
  "src/private/MediaRemote.m",
  "src/utility/Debounce.m",
  "src/utility/helpers.m",
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const outputDir = path.join(root, "src-tauri", "target", "mediaremote-adapter");

export function infoPlist(version) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>${NAME}</string>
  <key>CFBundleIdentifier</key><string>com.tixxin.fuyu.${NAME}</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>${NAME}</string>
  <key>CFBundlePackageType</key><string>FMWK</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleVersion</key><string>${version}</string>
</dict>
</plist>
`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.slice(0, 3).join(" ")} … failed`);
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not download ${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function stamp() {
  return `${ADAPTER.version} ${ADAPTER.commit}`;
}

export function isBuilt(dir = outputDir) {
  const stampFile = path.join(dir, "VERSION");
  return existsSync(stampFile) && readFileSync(stampFile, "utf8").trim() === stamp() && existsSync(path.join(dir, `${NAME}.framework`, NAME));
}

async function fetchSource(work) {
  const archive = await download(`https://codeload.github.com/ungive/mediaremote-adapter/tar.gz/${ADAPTER.commit}`);
  const digest = createHash("sha256").update(archive).digest("hex");
  if (digest !== ADAPTER.sha256) throw new Error(`mediaremote-adapter archive checksum is ${digest}, expected ${ADAPTER.sha256}`);
  const file = path.join(work, "source.tar.gz");
  writeFileSync(file, archive);
  run("tar", ["-xzf", file, "-C", work]);
  const folder = readdirSync(work).find((name) => name.startsWith("mediaremote-adapter-"));
  if (!folder) throw new Error("the mediaremote-adapter archive has no source folder");
  return path.join(work, folder);
}

function buildFramework(source, dir) {
  const framework = path.join(dir, `${NAME}.framework`);
  const version = path.join(framework, "Versions", "A");
  mkdirSync(path.join(version, "Resources"), { recursive: true });
  run("xcrun", [
    "clang",
    "-arch", "arm64",
    "-mmacosx-version-min=15.0",
    "-dynamiclib",
    "-fobjc-arc",
    "-fvisibility=default",
    "-O2",
    "-I", path.join(source, "include"),
    "-I", path.join(source, "src"),
    "-framework", "Foundation",
    "-framework", "AppKit",
    "-framework", "UniformTypeIdentifiers",
    "-install_name", `@rpath/${NAME}.framework/Versions/A/${NAME}`,
    "-o", path.join(version, NAME),
    ...SOURCES.map((file) => path.join(source, file)),
  ]);
  writeFileSync(path.join(version, "Resources", "Info.plist"), infoPlist(ADAPTER.version));
  symlinkSync("A", path.join(framework, "Versions", "Current"));
  symlinkSync(`Versions/Current/${NAME}`, path.join(framework, NAME));
  symlinkSync("Versions/Current/Resources", path.join(framework, "Resources"));
  run("codesign", ["--force", "--sign", "-", framework]);
}

export async function buildAdapter({ force = false } = {}) {
  if (process.platform !== "darwin") return null;
  if (!force && isBuilt()) return outputDir;
  const work = path.join(outputDir, ".work");
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const source = await fetchSource(work);
  buildFramework(source, outputDir);
  cpSync(path.join(source, "bin", "mediaremote-adapter.pl"), path.join(outputDir, "mediaremote-adapter.pl"));
  cpSync(path.join(source, "LICENSE"), path.join(outputDir, "LICENSE"));
  writeFileSync(path.join(outputDir, "VERSION"), `${stamp()}\n`);
  rmSync(work, { recursive: true, force: true });
  return outputDir;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildAdapter({ force: process.argv.includes("--force") })
    .then((dir) => {
      if (dir) console.log(`[mediaremote-adapter] ${ADAPTER.version} ready in ${path.relative(root, dir)}`);
    })
    .catch((error) => {
      console.error(`[mediaremote-adapter] ${error.message}`);
      process.exit(1);
    });
}
