import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DOC = "section 5 of docs/investigations/dev-island-issues.md";
const LOW_LABEL = /low mandatory level|低强制级别/i;

export function hasLowLabel(icaclsOutput) {
  return icaclsOutput.split(/\r?\n/).some((line) => LOW_LABEL.test(line));
}

function icacls(args) {
  return execFileSync("icacls", args, { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
}

export function restoreDebugIntegrity(root, platform = process.platform) {
  if (platform !== "win32") return "skipped";
  const debugDir = path.join(root, "src-tauri", "target", "debug");
  try {
    mkdirSync(debugDir, { recursive: true });
    if (!hasLowLabel(icacls([debugDir]))) return "fine";
    icacls([debugDir, "/setintegritylevel", "(OI)(CI)M", "/Q"]);
    if (hasLowLabel(icacls([debugDir]))) throw new Error("the folder is still labelled Low after the change");
    console.log(
      `Raised ${debugDir} from Low to Medium integrity: an island started from a Low-labelled folder runs at Low integrity, cannot write %APPDATA%, and WebView2 fails with 0x800700AA. See ${DOC}.`,
    );
    return "raised";
  } catch (error) {
    console.warn(
      `Could not check or raise the integrity level of ${debugDir} (${error instanceof Error ? error.message : error}). If the island panics with WebView2 0x800700AA, run: icacls "${debugDir}" /setintegritylevel (OI)(CI)M — see ${DOC}.`,
    );
    return "failed";
  }
}
