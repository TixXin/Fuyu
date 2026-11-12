import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOTS = ["src/windows/island", "src/features"];
const ALLOWED = [
  /features\/appearance\//,
  /features\/(plugins|plugin-dev|theme-market|ssh-tunnel|cc-connect|updater)\//,
  /features\/calendar\/CalendarSourcesSection\.css$/,
  /Settings[^/]*\.css$/,
  /features\/(clipboard|file-shelf)\//,
  /features\/center-pattern\//,
  /features\/screenshot\//,
  /features\/media\/MusicWaveButton\.css$/,
  /features\/todos\/TodoDatePicker\.css$/,
  /features\/agent-status\/approvals\//,
  /features\/calendar\/(CalendarMonth|CalendarPanel|MeetingLine)\.css$/,
  /windows\/island\/(IslandShell|IslandTopEdge|IslandApp)\.css$/,
  /windows\/island\/IslandGlassLight\.css$/,
];
const WHITE = /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,|color:\s*#fff(fff)?\s*;/g;

function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? cssFiles(full) : full.endsWith(".css") ? [full] : [];
  });
}

test("island styles write neutral whites through --overlay-rgb, so a light island can darken them", () => {
  const offenders = ROOTS.flatMap(cssFiles)
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => !ALLOWED.some((pattern) => pattern.test(file)))
    .flatMap((file) => (readFileSync(file, "utf8").match(WHITE) ?? []).map((hit) => `${file}: ${hit}`));
  assert.deepEqual(offenders, []);
});

test("the light island sets the overlay, error, warning and popover colours", () => {
  const tokens = readFileSync("src/styles/tokens.css", "utf8");
  const light = tokens.slice(tokens.indexOf(".island-light {"));
  for (const name of ["--overlay-rgb", "--error-text", "--warning-text", "--popover-fill", "--text-1"]) {
    assert.ok(light.includes(`${name}:`), name);
  }
});
