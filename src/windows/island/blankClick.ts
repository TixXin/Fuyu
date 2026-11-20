const INTERACTIVE = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  "summary",
  "img",
  "svg",
  "canvas",
  "video",
  "audio",
  "iframe",
  "[role='button']",
  "[role='link']",
  "[role='option']",
  "[role='menuitem']",
  "[role='tab']",
  "[role='checkbox']",
  "[role='switch']",
  "[role='slider']",
  "[role='textbox']",
  "[draggable='true']",
  "[contenteditable='true']",
  ".island__header",
].join(", ");

const ACTIVE_CURSORS = new Set(["pointer", "grab", "grabbing", "move", "text", "crosshair", "col-resize", "row-resize", "ew-resize", "ns-resize"]);

function hasOwnText(element: Element): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
  }
  return false;
}

function insideChild(element: Element, x: number, y: number): boolean {
  for (const child of element.children) {
    const rect = child.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
  }
  return false;
}

function activeCursorUpTo(element: Element, root: Element): boolean {
  for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
    if (ACTIVE_CURSORS.has(getComputedStyle(node).cursor)) return true;
  }
  return false;
}

export function isBlankClick(target: EventTarget | null, root: Element, x: number, y: number): boolean {
  if (!(target instanceof Element) || !root.contains(target)) return false;
  if (target.closest(INTERACTIVE)) return false;
  if (window.getSelection()?.toString()) return false;
  if (hasOwnText(target) || insideChild(target, x, y)) return false;
  return !activeCursorUpTo(target, root);
}
