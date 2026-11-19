import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { bundleShots, findBrowser, findSample, planShots, run } from "../../packages/plugin-cli/src/index.mjs";

const HELLO = fileURLToPath(new URL("../../packages/plugin-cli/test/fixtures/hello", import.meta.url));
const PAGE = "island.page/v1";
const BAR = "island.collapsed/v1";

const ISLAND = `import { useEffect, useState } from "react";
import "./island.css";

export default function apply(ctx: any) {
  const locale = () => (/^zh/.test(navigator.language) ? "zh" : "en");
  function useGreeting() {
    const [greeting, setGreeting] = useState<Record<string, string> | null>(null);
    useEffect(() => {
      ctx.host.call("greet", { who: "island" }).then(setGreeting, () => setGreeting(null));
      void ctx.host.call("missing").catch(() => {});
    }, []);
    return greeting;
  }
  function Page() {
    const greeting = useGreeting();
    return <div className="fuyu-hello">{greeting ? greeting[locale()] : "no data"} {new Date().getFullYear()}</div>;
  }
  function Bar() {
    const greeting = useGreeting();
    return greeting ? <span style={{ fontFamily: "monospace", fontSize: 14 }}>{greeting[locale()]}</span> : null;
  }
  ctx.slots.add("${PAGE}", { id: "hello", title: { "zh-CN": "你好", en: "Hello" }, component: Page });
  ctx.slots.add("${BAR}", { id: "hello-bar", component: Bar, opens: "hello" });
}
`;

const SAMPLE = `export default {
  now: "2031-05-06T07:08:09",
  host: { calls: { greet: (params: { who: string }) => ({ zh: "hi", en: "hello to the " + params.who + " from the sample" }) } },
  shots: [
    { slot: "${PAGE}", file: "page.png" },
    { slot: "${BAR}", file: "bar.png" },
    { slot: "${BAR}", file: "bar-en.png", locale: "en", theme: "light" },
    { slot: "${PAGE}", file: "narrow.png", width: 420, height: 300 },
  ],
};
`;

const scratch = mkdtempSync(join(tmpdir(), "plugin-cli-shots-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let next = 0;

function plugin(sample = SAMPLE) {
  const dir = join(scratch, `${++next}`, "hello");
  cpSync(HELLO, dir, { recursive: true });
  writeFileSync(join(dir, "src", "island.tsx"), ISLAND);
  if (sample) {
    mkdirSync(join(dir, "shots"));
    writeFileSync(join(dir, "shots", "sample.ts"), sample);
  }
  return dir;
}

function capture(cwd) {
  const stdout = [];
  const stderr = [];
  return {
    io: { cwd, env: process.env, stdout: { write: (text) => stdout.push(text) }, stderr: { write: (text) => stderr.push(text) } },
    stdout: () => stdout.join(""),
    stderr: () => stderr.join(""),
  };
}

function pngSize(file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString("latin1"), "PNG", file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function browser() {
  try {
    return findBrowser();
  } catch {
    return null;
  }
}

test("without a shots list the plan is page.png and bar.png for the slots the plugin uses", () => {
  const both = planShots({ items: [{ slot: PAGE }, { slot: BAR }, { slot: "settings.section/v1" }], shots: null });
  assert.deepEqual(both.map((shot) => [shot.slot, shot.file, shot.theme, shot.locale]), [[PAGE, "page.png", "dark", "zh-CN"], [BAR, "bar.png", "dark", "zh-CN"]]);
  const light = planShots({ items: [{ slot: BAR }], shots: null }, { theme: "light", locale: "en" });
  assert.deepEqual(light.map((shot) => [shot.file, shot.theme, shot.locale]), [["bar.png", "light", "en"]]);
  assert.throws(() => planShots({ items: [{ slot: "settings.section/v1" }], shots: null }), /registers nothing in island\.page\/v1 or island\.collapsed\/v1/);
});

test("a shots list is checked before the browser is used: slot, file name, duplicates, theme, size", () => {
  const items = [{ slot: PAGE }];
  const plan = (shots) => planShots({ items, shots });
  assert.deepEqual(plan([{ slot: PAGE, file: "a.png", id: "x", theme: "light", width: 420 }]), [{ slot: PAGE, file: "a.png", id: "x", theme: "light", locale: "zh-CN", width: 420, height: null }]);
  assert.throws(() => plan([{ slot: "settings.section/v1", file: "a.png" }]), /shots\[0\]\.slot must be/);
  assert.throws(() => plan([{ slot: PAGE, file: "../a.png" }]), /shots\[0\]\.file must be a \.png file name/);
  assert.throws(() => plan([{ slot: PAGE, file: "a.jpg" }]), /shots\[0\]\.file/);
  assert.throws(() => plan([{ slot: PAGE, file: "a.png" }, { slot: PAGE, file: "A.png" }]), /A\.png is used twice/);
  assert.throws(() => plan([{ slot: PAGE, file: "a.png", theme: "sepia" }]), /theme must be dark or light/);
  assert.throws(() => plan([{ slot: PAGE, file: "a.png", width: 20 }]), /width must be a whole number/);
  assert.throws(() => plan([]), /shots list is empty/);
});

test("the sample is shots/sample.* in the plugin folder, and only one of them", () => {
  const dir = plugin();
  assert.equal(findSample(dir), join(dir, "shots", "sample.ts"));
  assert.equal(findSample(plugin(null)), null);
  writeFileSync(join(dir, "shots", "sample.json"), "{}");
  assert.throws(() => findSample(dir), /more than one sample file/);
});

test("the screenshot page bundles the island part with its styles, React and the sample into one script", async () => {
  const dir = plugin();
  const page = await bundleShots({ dir, client: join(dir, "src", "island.tsx"), sample: findSample(dir) });
  assert.match(page.js, /from the sample/);
  assert.match(page.js, /createRoot/);
  assert.doesNotMatch(page.js, /__shared\/react/);
  assert.match(page.css, /\.fuyu-hello/);
});

test("shots captures the page and the collapsed item with the sample's answers, per theme and locale, and composes the cover", async (t) => {
  if (!browser()) return t.skip("no Chrome, Edge or Chromium on this machine");
  const dir = plugin();
  const out = capture(dir);
  assert.equal(await run(["shots"], out.io), 0, out.stderr());
  const size = (name) => pngSize(join(dir, "screenshots", name));
  assert.deepEqual(size("page.png"), { width: 1584, height: 720 });
  assert.deepEqual(size("narrow.png"), { width: 840, height: 600 });
  assert.deepEqual(size("cover.png"), { width: 1280, height: 800 });
  assert.equal(size("bar.png").height, 76);
  assert.ok(size("bar-en.png").width > size("bar.png").width + 200, `${size("bar-en.png").width} vs ${size("bar.png").width}`);
  assert.match(out.stdout(), /wrote screenshots[/\\]bar-en\.png \(\d+x76, island\.collapsed\/v1, light, en\)/);
  assert.match(out.stdout(), /wrote screenshots[/\\]cover\.png \(1280x800, cover from page\.png on #[0-9a-f]{6}\)/);
  assert.match(out.stderr(), /warning: the sample has no answer for the host call "missing".*\[shots:unanswered\]/);
  assert.doesNotMatch(out.stderr(), /"greet"/);

  const elsewhere = capture(dir);
  assert.equal(await run(["shots", "--out", "art", "--no-cover", "--scale", "1"], elsewhere.io), 0, elsewhere.stderr());
  assert.deepEqual(pngSize(join(dir, "art", "page.png")), { width: 792, height: 360 });
  assert.equal(existsSync(join(dir, "art", "cover.png")), false);
});

test("shots fails when the collapsed item shows nothing with the sample, and says which file", async (t) => {
  if (!browser()) return t.skip("no Chrome, Edge or Chromium on this machine");
  const dir = plugin(null);
  const out = capture(dir);
  assert.equal(await run(["shots"], out.io), 1);
  assert.match(out.stderr(), /error: bar\.png: the island\.collapsed\/v1 component rendered nothing with this sample/);
  assert.ok(existsSync(join(dir, "screenshots", "page.png")));
});

test("shots needs an island part and a browser, and says so", async () => {
  const dir = plugin();
  const pkgFile = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  const lost = capture(dir);
  lost.io.env = { CHROME_PATH: join(dir, "no-such-browser") };
  assert.equal(await run(["shots"], lost.io), 1);
  assert.match(lost.stderr(), /CHROME_PATH points to .*no-such-browser, which does not exist/);
  delete pkg.fuyu.client;
  writeFileSync(pkgFile, JSON.stringify(pkg));
  const none = capture(dir);
  assert.equal(await run(["shots"], none.io), 1);
  assert.match(none.stderr(), /this plugin has no island part \(fuyu\.client\.island\)/);
});
