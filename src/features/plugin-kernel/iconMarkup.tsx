import { createElement, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

const cache = new WeakMap<object, string | null>();

export function iconMarkup(icon: unknown): string | null {
  if (typeof icon !== "function" && (typeof icon !== "object" || icon === null)) return null;
  const key = icon as object;
  if (cache.has(key)) return cache.get(key) ?? null;
  let markup: string | null = null;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(icon as ComponentType<{ size: number }>, { size: 16 })));
    const svg = host.querySelector("svg");
    markup = svg ? svg.outerHTML : null;
  } catch {
    markup = null;
  } finally {
    root.unmount();
  }
  cache.set(key, markup);
  return markup;
}
