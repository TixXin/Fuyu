import { MIRROR_INHERITED, MIRROR_SHEET } from "./barMirror.ts";

const SKIPPED = /^(animation|transition|cursor|pointer-events|will-change|view-transition|content$|content-visibility|scroll-|overscroll|touch-action|user-select|-webkit-user-|-webkit-tap-|caret-|resize$)/;
const INHERITED = new Set<string>(MIRROR_INHERITED);

export type StyleValues = Map<string, string>;

let probes: ShadowRoot | null = null;
const baselines = new Map<string, StyleValues>();

export function styleValues(style: CSSStyleDeclaration): StyleValues {
  const values: StyleValues = new Map();
  for (let index = 0; index < style.length; index += 1) {
    const name = style[index];
    if (!SKIPPED.test(name)) values.set(name, style.getPropertyValue(name));
  }
  return values;
}

export function baselineOf(element: Element): StyleValues {
  const key = `${element.namespaceURI}|${element.localName}`;
  const known = baselines.get(key);
  if (known) return known;
  if (!probes) {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "all: initial; display: none;";
    document.documentElement.append(host);
    probes = host.attachShadow({ mode: "open" });
    const sheet = document.createElement("style");
    sheet.textContent = MIRROR_SHEET;
    probes.append(sheet);
  }
  const probe = document.createElementNS(element.namespaceURI, element.localName);
  probes.append(probe);
  const values = styleValues(getComputedStyle(probe));
  probe.remove();
  baselines.set(key, values);
  return values;
}

export function writeStyle(
  target: HTMLElement | SVGElement,
  values: StyleValues,
  base: StyleValues,
  parent: { values: StyleValues; base: StyleValues } | null,
) {
  for (const [name, value] of values) {
    const above = parent?.values.get(name);
    if (above === value && INHERITED.has(name)) continue;
    if (value === base.get(name) && (above === undefined || above === value || above === parent?.base.get(name))) continue;
    target.style.setProperty(name, value);
  }
}
