import { act, StrictMode, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import { createSlots } from "@fuyu/plugin-base/client";
import { SLOT_THEME } from "@fuyu/plugin-base/protocol";
import { PluginSlotItems } from "../../src/features/plugin-kernel/PluginSlot";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const NAME = "island.dev/v1";
const style: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  margin: "4px 8px",
  padding: "4px 8px",
  borderRadius: "var(--fuyu-plugin-radius)",
  font: "12px ui-monospace, monospace",
  color: "var(--fuyu-plugin-text-secondary)",
  background: "var(--fuyu-plugin-surface)",
  minWidth: 0,
  whiteSpace: "nowrap",
};
const Hello = () => (
  <div className="demo" style={style}>
    <span className="greeting" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>hello island, from the plugin host (pid 4242)</span>
    <span className="count" style={{ flexShrink: 0, color: "var(--fuyu-plugin-text-muted)" }}>#12</span>
  </div>
);
const Builtin = () => <div className="builtin">built-in row</div>;

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const results = document.getElementById("results")!;
const island = document.getElementById("island")!;

const parse = (color: string) => {
  const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
};
const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const over = (top: ReturnType<typeof parse>, bottom: { r: number; g: number; b: number }) => ({
  r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a),
});
const contrast = (el: HTMLElement, base: { r: number; g: number; b: number }) => {
  const cs = getComputedStyle(el);
  const fill = over(parse(cs.backgroundColor), base);
  const ink = over(parse(cs.color), fill);
  const [hi, lo] = [lum(ink), lum(fill)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

try {
  const registry = createSlots({ [NAME]: { kind: "list", max: 3, perPlugin: 1 } });
  registry.add(NAME, { id: "core", component: Builtin });
  registry.add(NAME, { id: "hello", component: Hello }, "hello");
  await act(async () => {
    createRoot(island).render(<StrictMode><PluginSlotItems registry={registry} name={NAME} /></StrictMode>);
  });

  const demo = island.querySelector<HTMLElement>(".demo")!;
  const slot = demo.closest<HTMLElement>(".plugin-slot")!;
  check(slot && slot.dataset.slot === NAME, "The slot wraps a plugin's item in .plugin-slot with the slot name");
  const builtin = island.querySelector<HTMLElement>(".builtin");
  check(builtin && !builtin.closest(".plugin-slot") && island.querySelectorAll(".plugin-slot").length === 1, "and leaves a built-in item unwrapped, so built-in rows keep the island's own colours");
  check(getComputedStyle(slot).display === "contents", "and the wrapper adds no box, so the island layout stays the same");
  const missing = SLOT_THEME.filter((name) => getComputedStyle(slot).getPropertyValue(name).trim() === "");
  check(missing.length === 0, `Every public theme variable is defined on the slot (${SLOT_THEME.length}); missing: ${missing.join(", ") || "none"}`);
  const dark = contrast(demo, { r: 0, g: 0, b: 0 });
  check(dark >= 4.5, `On the dark island the demo row reads at ${dark.toFixed(1)}:1`);

  island.style.width = "300px";
  const lineHeight = parseFloat(getComputedStyle(demo).lineHeight) || 16;
  check(demo.querySelector<HTMLElement>(".greeting")!.offsetHeight <= lineHeight * 1.5, "On a narrow island the greeting stays on one line and is cut with an ellipsis");
  const count = demo.querySelector<HTMLElement>(".count")!.getBoundingClientRect();
  check(count.right <= demo.getBoundingClientRect().right + 0.5 && count.width > 0, "and the counter stays whole inside the row");
  island.style.width = "";

  document.documentElement.classList.add("island-light");
  island.style.background = "#f2f2f5";
  const light = contrast(demo, { r: 242, g: 242, b: 245 });
  check(light >= 4.5, `On the light island the same row reads at ${light.toFixed(1)}:1 (it was white on light grey before the theme variables)`);
  document.documentElement.classList.remove("island-light");
  island.style.background = "";

  results.dataset.result = "passed";
  results.textContent = [...messages, `ALL PASS (${messages.length})`].join("\n");
} catch (error) {
  results.dataset.result = "failed";
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
}
