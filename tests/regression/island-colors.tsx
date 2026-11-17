import { StrictMode, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import { I18nProvider } from "../../src/i18n";
import { IslandPreview } from "../../src/components/island-preview/IslandPreview";
import { BUILTIN_THEME_IDS, BUILTIN_THEMES, builtinThemeInUse, withBuiltinTheme, type BuiltinThemeId } from "../../src/lib/theme/builtinThemes";
import { DEFAULT_SETTINGS, hexToRgba, normalizeSettings } from "../../src/lib/settings/settings";
import { inkVariables, resolveThemeColors, type ThemeTone } from "../../src/lib/theme/themeMode";
import { isLightIsland } from "../../src/utils/color";

const query = new URLSearchParams(location.search);
const automated = query.has("test");
const desk = query.get("desk") === "light" ? "#e9edf3" : "#2b4a7a";
document.body.style.background = desk;

type Swatch = { id: string; label: string; tone: ThemeTone; background: string; ink: string; opacity: number };

const swatches: Swatch[] = [
  ...BUILTIN_THEME_IDS.flatMap((id) => (["light", "dark"] as const).map((tone) => ({
    id: `${id}-${tone}`,
    label: `${id} · ${tone}`,
    tone,
    background: BUILTIN_THEMES[id][tone].islandBackgroundColor,
    ink: BUILTIN_THEMES[id][tone].inkColor,
    opacity: BUILTIN_THEMES[id].opacity,
  }))),
  { id: "custom-dark", label: "custom ink · dark", tone: "dark", background: "#030303", ink: "#ffd9a0", opacity: 100 },
];

function SwatchView({ swatch }: { swatch: Swatch }) {
  const style = {
    ...inkVariables({ islandBackgroundColor: swatch.background, inkColor: swatch.ink }),
    "--island-fill": hexToRgba(swatch.background, swatch.opacity / 100),
    background: "var(--island-fill)",
    padding: "10px 16px",
    borderRadius: 20,
    boxShadow: "inset 0 0 0 1px var(--color-white-a08)",
    display: "grid",
    gap: 2,
    width: 220,
  } as CSSProperties;
  return (
    <div className={isLightIsland(swatch.background) ? "island-light" : undefined} style={style} data-swatch={swatch.id}>
      <span data-level="1" style={{ color: "var(--text-1)", fontSize: 14 }}>{swatch.label}</span>
      <span data-level="2" style={{ color: "var(--text-2)" }}>周报交给龙虾写 · 还剩 3 件</span>
      <span data-level="3" style={{ color: "var(--text-3)", fontSize: 12 }}>8 分钟后 · 周会</span>
      <span data-level="ink" style={{ color: "rgba(var(--island-ink-rgb), 0.96)", fontSize: 12 }}>Agent · 等你确认</span>
    </div>
  );
}

function Page() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {swatches.map((swatch) => <SwatchView key={swatch.id} swatch={swatch} />)}
      </div>
      <div style={{ display: automated ? "none" : "flex", flexWrap: "wrap", gap: 12 }}>
        {BUILTIN_THEME_IDS.flatMap((id) => [false, true].map((dark) => (
          <div key={`${id}-${dark}`} style={{ width: 340 }}>
            <IslandPreview settings={resolveThemeColors({ ...withBuiltinTheme(DEFAULT_SETTINGS, id), themeMode: dark ? "dark" : "light", collapsedDark: false }, dark)} />
          </div>
        )))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <Page />
    </I18nProvider>
  </StrictMode>,
);

const results = document.getElementById("results")!;
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};

type Rgba = [number, number, number, number];
const parse = (color: string): Rgba => {
  const parts = color.match(/[\d.]+/g)!.map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
};
const over = (top: Rgba, bottom: Rgba): Rgba => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1) as Rgba;
const luminance = ([r, g, b]: Rgba) => {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: Rgba, b: Rgba) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
const MINIMUM: Record<string, number> = { "1": 4.5, "2": 4.5, "3": 3, ink: 4.5 };
const LIGHT_TOKENS = ["--overlay-rgb", "--error-text", "--warning-text", "--popover-fill", "--text-1"];
const tokensOn = (className: string) => {
  const element = document.createElement("div");
  element.className = className;
  document.body.append(element);
  const style = getComputedStyle(element);
  const values = Object.fromEntries(LIGHT_TOKENS.map((name) => [name, style.getPropertyValue(name).trim()]));
  element.remove();
  return values;
};
const DESKS: [string, Rgba][] = [["black", [0, 0, 0, 1]], ["white", [255, 255, 255, 1]], ["blue", [43, 74, 122, 1]]];

async function runChecks() {
  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const swatch of swatches) {
      const element = document.querySelector<HTMLElement>(`[data-swatch="${swatch.id}"]`)!;
      const fill = parse(getComputedStyle(element).backgroundColor);
      for (const [deskName, deskColor] of DESKS) {
        const backdrop = over(fill, deskColor);
        const worst = [...element.querySelectorAll<HTMLElement>("[data-level]")].map((span) => {
          const level = span.dataset.level!;
          const value = ratio(over(parse(getComputedStyle(span).color), backdrop), backdrop);
          if (value < MINIMUM[level]) throw new Error(`${swatch.label} text ${level} on a ${deskName} desktop is ${value.toFixed(2)}:1`);
          return value;
        });
        check(worst.length === 4, `${swatch.label} on a ${deskName} desktop: ${worst.map((v) => v.toFixed(1)).join(" / ")}`);
      }
    }

    const [lightTokens, darkTokens] = [tokensOn("island-light"), tokensOn("")];
    const unset = LIGHT_TOKENS.filter((name) => !lightTokens[name] || lightTokens[name] === darkTokens[name]);
    check(unset.length === 0, `A light island sets its own ${LIGHT_TOKENS.join(", ")}; left as on the dark island: ${unset.join(", ") || "none"}`);

    const custom = document.querySelector<HTMLElement>('[data-swatch="custom-dark"] [data-level="1"]')!;
    check(getComputedStyle(custom).color === "rgba(255, 217, 160, 0.96)", "A custom ink colours the text levels");
    const auto = document.querySelector<HTMLElement>('[data-swatch="greyWhite-light"]')!;
    check(getComputedStyle(auto).getPropertyValue("--island-ink-rgb").trim() === "24, 24, 30", "Auto ink stays as before on a light island");

    for (const id of BUILTIN_THEME_IDS) {
      const applied = withBuiltinTheme(DEFAULT_SETTINGS, id);
      check(builtinThemeInUse(normalizeSettings(applied)) === id && applied.themeMode === "light", `${id} survives saving and reads as in use`);
    }
    const old = normalizeSettings({ darkBackgroundColor: "#030303", lightBackgroundColor: "#f2f2f5" });
    check(old.darkInkColor === "" && old.lightInkColor === "" && old.inkColor === "", "Settings saved before C33.9 read as auto ink");
    const system = withBuiltinTheme({ ...DEFAULT_SETTINGS, themeMode: "system" }, "frostedWarm" satisfies BuiltinThemeId);
    check(system.themeMode === "system", "Following the system stays on");

    if (automated) document.querySelector<HTMLElement>('[data-swatch="custom-dark"]')!.hidden = true;
    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
