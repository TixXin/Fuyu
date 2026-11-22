import { MIRROR_HTML_LIMIT, type MirrorBox, type MirrorForm, type MirrorFrame, type MirrorItem } from "./barMirror.ts";
import { baselineOf, styleValues, writeStyle, type StyleValues } from "./barMirrorStyle.ts";

const BAR = ".island__collapsed";
const MARK = "data-bar-mark";
const UNIT = "data-bar-items";
const AFTER_ITEMS = `[${MARK}], .island__open-button, .island__more-chip, .island__quiet-button`;
const HIDDEN: MirrorFrame = { shown: false, form: "bar", width: 0, height: 0, html: "", items: [], more: null, middle: null, center: null };

type Above = { values: StyleValues; base: StyleValues };
type Area = { left: number; top: number; right: number; bottom: number };

function pseudo(source: Element, which: "::before" | "::after", above: Above): HTMLElement | null {
  const style = getComputedStyle(source, which);
  const content = style.content;
  if (!content || content === "none" || content === "normal" || style.display === "none") return null;
  const span = document.createElement("span");
  span.dataset.pseudo = which.slice(2);
  writeStyle(span, styleValues(style), baselineOf(span), above);
  const text = /^"([\s\S]*)"$/.exec(content);
  if (text) span.textContent = text[1].replace(/\\(.)/g, "$1");
  return span;
}

function copy(source: Element, above: Above | null): Element | null {
  if (source.localName === "script" || source.localName === "style") return null;
  const style = getComputedStyle(source);
  if (above && (source.hasAttribute("inert") || style.display === "none")) return null;
  const target = source.localName === "canvas" ? document.createElement("div") : (source.cloneNode(false) as Element);
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) return null;
  for (const name of target.getAttributeNames()) if (name === "style" || name.startsWith("on")) target.removeAttribute(name);
  if (source instanceof HTMLImageElement) target.setAttribute("src", source.currentSrc || source.src);
  const here: Above = { values: styleValues(style), base: baselineOf(target) };
  writeStyle(target, here.values, here.base, above);
  const replaced = source instanceof HTMLImageElement || source instanceof HTMLInputElement || source.localName === "canvas" || source instanceof SVGElement;
  const before = replaced ? null : pseudo(source, "::before", here);
  if (before) target.append(before);
  for (const child of source.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) target.append(child.cloneNode());
    else if (child instanceof Element) {
      const made = copy(child, here);
      if (made) target.append(made);
    }
  }
  const after = replaced ? null : pseudo(source, "::after", here);
  if (after) target.append(after);
  return target;
}

function areaOf(elements: Iterable<Element>): Area | null {
  let area: Area | null = null;
  for (const element of elements) {
    const rects = element.getClientRects();
    const box = rects.length > 0 ? element.getBoundingClientRect() : areaOf(element.children);
    if (!box || box.right - box.left < 0.5 || box.bottom - box.top < 0.5) continue;
    area = area
      ? { left: Math.min(area.left, box.left), top: Math.min(area.top, box.top), right: Math.max(area.right, box.right), bottom: Math.max(area.bottom, box.bottom) }
      : { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }
  return area;
}

function unitParts(bar: HTMLElement): { ids: string[]; elements: Element[] }[] {
  const units: { ids: string[]; elements: Element[] }[] = [];
  const ids = (value: string | null) => (value ?? "").split(" ").filter(Boolean);
  for (const wrap of bar.querySelectorAll(`[${UNIT}]`)) units.push({ ids: ids(wrap.getAttribute(UNIT)), elements: [...wrap.children] });
  for (const mark of bar.querySelectorAll(`[${MARK}]`)) {
    const elements: Element[] = [];
    for (let next = mark.nextElementSibling; next && !next.matches(AFTER_ITEMS); next = next.nextElementSibling) elements.push(next);
    units.push({ ids: ids(mark.getAttribute(MARK)), elements });
  }
  return units;
}

export function captureBarMirror(): MirrorFrame {
  const bar = document.querySelector<HTMLElement>(BAR);
  const shell = bar?.closest<HTMLElement>(".island");
  if (!bar || !shell || shell.offsetWidth === 0 || !shell.classList.contains("island--collapsed") || shell.classList.contains("island--tucked")) return HIDDEN;
  const frame = shell.getBoundingClientRect();
  if (frame.width === 0 || frame.height === 0) return HIDDEN;
  const ratio = shell.offsetWidth / frame.width;
  const box = (area: Area | null): MirrorBox | null =>
    area && { left: (area.left - frame.left) * ratio, top: (area.top - frame.top) * ratio, width: (area.right - area.left) * ratio, height: (area.bottom - area.top) * ratio };
  const one = (selector: string) => {
    const found = bar.querySelector(selector);
    return found ? box(areaOf([found])) : null;
  };
  const root = copy(shell, null);
  if (!(root instanceof HTMLElement)) return HIDDEN;
  for (const [name, value] of [["position", "relative"], ["inset", "auto"], ["margin", "0"], ["transform", "none"], ["translate", "none"], ["scale", "none"]]) root.style.setProperty(name, value);
  const html = root.outerHTML;
  if (html.length > MIRROR_HTML_LIMIT) return HIDDEN;
  const items: MirrorItem[] = [];
  for (const { ids, elements } of unitParts(bar)) {
    const whole = box(areaOf(elements));
    if (!whole || ids.length === 0) continue;
    const members = ids.length > 1 && elements.length === 1 && elements[0].children.length === ids.length ? [...elements[0].children] : null;
    ids.forEach((id, index) => {
      const own = members ? box(areaOf([members[index]])) : { ...whole, left: whole.left + (whole.width / ids.length) * index, width: whole.width / ids.length };
      if (own) items.push({ id, box: own });
    });
  }
  const form: MirrorForm = shell.classList.contains("island--side") ? "side"
    : [...shell.classList].some((name) => name.startsWith("island--taskbar-")) ? "taskbar"
      : bar.querySelector(".island__notch-row") ? "notch" : "bar";
  return {
    shown: true,
    form,
    width: shell.offsetWidth,
    height: shell.offsetHeight,
    html,
    items,
    more: one(".island__more-chip"),
    middle: one(form === "notch" ? ".island__notch-gap" : ".island__open-button"),
    center: one(".island__center-slot"),
  };
}
