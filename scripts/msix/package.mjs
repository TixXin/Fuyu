import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { mainCheckout, targetDir } from "../build-dirs.mjs";
import { fillManifest, packageFileName, resolveIdentity, sdkVersionsNewestFirst, storeVersion } from "./manifest.mjs";

const ASSETS = ["Square44x44Logo.png", "Square150x150Logo.png", "StoreLogo.png"];
const LANGUAGES = ["zh-CN", "en-US"];

function fail(message) {
  console.error(`msix: ${message}`);
  process.exit(1);
}

function sdkTool(name) {
  const root = path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Windows Kits", "10", "bin");
  if (!existsSync(root)) fail(`Windows SDK not found under ${root}. Install the Windows 10/11 SDK (MakeAppx, MakePri, SignTool).`);
  for (const version of sdkVersionsNewestFirst(readdirSync(root))) {
    const tool = path.join(root, version, "x64", name);
    if (existsSync(tool)) return tool;
  }
  fail(`${name} not found in any Windows SDK under ${root}.`);
}

function run(tool, args) {
  const result = spawnSync(tool, args, { stdio: "inherit" });
  if (result.error) fail(`${path.basename(tool)} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${path.basename(tool)} exited with ${result.status}.`);
}

const { values } = parseArgs({
  options: {
    exe: { type: "string" },
    out: { type: "string" },
    "test-identity": { type: "boolean", default: false },
    "allow-prerelease": { type: "boolean", default: false },
    "test-cert": { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(`pnpm msix [--exe <fuyu.exe>] [--out <dir>] [--test-identity] [--allow-prerelease] [--test-cert <thumbprint>]

Packs the release fuyu.exe into an unsigned MSIX for Microsoft Store submission.
  --exe               defaults to src-tauri/target/release/fuyu.exe (build it first with pnpm build:exe)
  --out               defaults to src-tauri/target/msix
  --test-identity     use a local test identity instead of src-tauri/msix/store-identity.json
  --allow-prerelease  allow a beta version (local tests only, the Store takes stable versions)
  --test-cert         sign a copy with this certificate thumbprint from CurrentUser\\My for a local install`);
  process.exit(0);
}

if (process.platform !== "win32") fail("MSIX packages are built on Windows.");

const main = mainCheckout();
const msixDir = path.join(main, "src-tauri", "msix");
const exe = path.resolve(values.exe ?? path.join(targetDir(main, "release"), "fuyu.exe"));
if (!existsSync(exe)) fail(`${exe} does not exist. Run pnpm build:exe first.`);

const config = JSON.parse(readFileSync(path.join(main, "src-tauri", "tauri.conf.json"), "utf8"));
let version;
let identity;
try {
  version = storeVersion(config.version, { allowPrerelease: values["allow-prerelease"] });
  identity = resolveIdentity(JSON.parse(readFileSync(path.join(msixDir, "store-identity.json"), "utf8")), { testIdentity: values["test-identity"] });
} catch (error) {
  fail(error.message);
}

const out = path.resolve(values.out ?? targetDir(main, "msix"));
const work = path.join(out, "work");
const stage = path.join(work, "stage");
rmSync(work, { recursive: true, force: true });
mkdirSync(path.join(stage, "Assets"), { recursive: true });

copyFileSync(exe, path.join(stage, "fuyu.exe"));
for (const asset of ASSETS) copyFileSync(path.join(main, "src-tauri", "icons", asset), path.join(stage, "Assets", asset));
for (const language of LANGUAGES) cpSync(path.join(msixDir, "Strings", language), path.join(stage, "Strings", language), { recursive: true });
const template = readFileSync(path.join(msixDir, "AppxManifest.xml.in"), "utf8");
writeFileSync(path.join(stage, "AppxManifest.xml"), fillManifest(template, identity, version));

const makepri = sdkTool("makepri.exe");
const priConfig = path.join(work, "priconfig.xml");
run(makepri, ["createconfig", "/cf", priConfig, "/dq", LANGUAGES.join("_"), "/pv", "10.0.0", "/o"]);
run(makepri, ["new", "/pr", stage, "/cf", priConfig, "/mn", path.join(stage, "AppxManifest.xml"), "/of", path.join(stage, "resources.pri"), "/o"]);

const makeappx = sdkTool("makeappx.exe");
const packagePath = path.join(out, packageFileName(identity, version));
run(makeappx, ["pack", "/d", stage, "/p", packagePath, "/o"]);

if (values["test-cert"]) {
  const signtool = sdkTool("signtool.exe");
  run(signtool, ["sign", "/fd", "SHA256", "/sha1", values["test-cert"], "/s", "My", packagePath]);
}

const sha256 = createHash("sha256").update(readFileSync(packagePath)).digest("hex");
writeFileSync(`${packagePath}.sha256`, `${sha256}  ${path.basename(packagePath)}\n`);
console.log(`msix: ${packagePath}`);
console.log(`msix: version ${version}, identity ${identity.name} (${identity.publisher})${values["test-cert"] ? ", signed for a local test" : ", unsigned for Store submission"}`);
