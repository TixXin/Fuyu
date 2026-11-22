import { MIRROR_INHERITED, MIRROR_SHEET } from "./barMirror.ts";

const SKIPPED = /^(--|animation|transition|cursor|pointer-events|will-change|view-transition|content$|content-visibility|scroll-|overscroll|touch-action|user-select|-webkit-user-|-webkit-tap-|caret-|resize$|-webkit-(?:border|margin|padding|logical|min-logical|max-logical)-(?:before|after|start|end))/;
const LOGICAL = /^(?:(?:min-|max-)?(?:block|inline)-size|inset-(?:block|inline)|(?:border|margin|padding)-(?:block|inline)|border-(?:start|end)-(?:start|end)-radius|contain-intrinsic-(?:block|inline)-size|overflow-(?:block|inline))/;
const INHERITED = new Set<string>(MIRROR_INHERITED);
const ALWAYS = /^(?:(?:min|max)-(?:width|height)|padding-(?:top|right|bottom|left)|margin-(?:top|right|bottom|left)|flex-basis)$/;

export type StyleValues = Map<string, string>;

let probes: ShadowRoot | null = null;
const baselines = new Map<string, StyleValues>();

export function styleValues(style: CSSStyleDeclaration): StyleValues {
  const values: StyleValues = new Map();
  for (let index = 0; index < style.length; index += 1) {
    const name = style[index];
    if (!SKIPPED.test(name) && !LOGICAL.test(name)) values.set(name, style.getPropertyValue(name));
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
    host.style.cssText = "all: initial; position: fixed; left: -10000px; top: 0; visibility: hidden; contain: strict; width: 0; height: 0;";
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
    if (!ALWAYS.test(name) && value === base.get(name) && (above === undefined || above === value || above === parent?.base.get(name))) continue;
    target.style.setProperty(name, value);
  }
}
