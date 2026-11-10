import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// A white written as a literal stays white on a light island (C33.1) and turns unreadable. Island
// styles write neutral whites as rgba(var(--overlay-rgb, 255, 255, 255), a) instead: the same white
// on a dark island, dark ink on a light one (.island-light in tokens.css).
const ROOTS = ["src/windows/island", "src/features"];
// Not on the island, or white on purpose.
const ALLOWED = [
  /features\/appearance\//, // settings window
  /features\/(plugins|plugin-dev|theme-market|ssh-tunnel|cc-connect|updater)\//,
  /features\/calendar\/CalendarSourcesSection\.css$/, // settings window
  /Settings[^/]*\.css$/,
  /features\/(clipboard|file-shelf)\//, // C29 redesign, on --island-ink-rgb
  /features\/center-pattern\//, // drawn on its own fill
  /features\/screenshot\//, // the screenshot overlay's dark boxes over the frozen screen, not the island
  /features\/media\/MusicWaveButton\.css$/, // a glass bubble on the collapsed island
  /features\/todos\/TodoDatePicker\.css$/, // a light chip
  /features\/agent-status\/approvals\//, // white on the filled green buttons
  /features\/calendar\/(CalendarMonth|CalendarPanel|MeetingLine)\.css$/, // white on the accent, ink via --calendar-ink
  /windows\/island\/(IslandShell|IslandTopEdge|IslandApp)\.css$/, // the dark liquid glass; IslandGlassLight.css is its light version
  /windows\/island\/IslandGlassLight\.css$/, // white highlights on a light island, on purpose (C33.4)
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
