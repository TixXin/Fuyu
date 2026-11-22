import { act } from "react";
import { captureBarMirror } from "../../src/features/plugin-kernel/barMirrorCapture";
import { endBarMirrorWatch, holdBarMirrorWatch } from "../../src/features/plugin-kernel/barMirrorWatch";
import { paintMirror } from "../../src/windows/settings/island-layout/mirrorPaint";

const TOLERANCE = 1;
const LOOKS = ["color", "background-color", "opacity", "border-top-left-radius", "font-size", "font-weight"];

const kept = (element: Element) => element.localName !== "script" && element.localName !== "style" && !element.hasAttribute("inert") && getComputedStyle(element).display !== "none";

function pairs(source: Element, copy: Element, out: [Element, Element][]) {
  out.push([source, copy]);
  const from = [...source.children].filter(kept);
  const to = [...copy.children].filter((child) => !child.hasAttribute("data-pseudo"));
  if (from.length !== to.length) throw new Error(`${source.className}: ${from.length} children on the island, ${to.length} in the mirror`);
  from.forEach((child, index) => pairs(child, to[index], out));
}

export async function mirrorDiffers(): Promise<string | null> {
  await act(async () => {
    holdBarMirrorWatch();
  });
  const frame = captureBarMirror();
  if (!frame.shown) return "the island reported nothing to mirror";
  const shell = document.querySelector(".island__collapsed")!.closest<HTMLElement>(".island")!;
  const host = document.createElement("div");
  host.style.cssText = "position: fixed; left: 0; top: 400px;";
  document.body.append(host);
  try {
    const root = paintMirror(host, frame.html);
    const copy = root.querySelector(".island");
    if (!copy) return "the mirror has no island in it";
    const all: [Element, Element][] = [];
    pairs(shell, copy, all);
    const here = shell.getBoundingClientRect();
    const there = copy.getBoundingClientRect();
    const ratio = shell.offsetWidth / here.width;
    for (const [source, mirrored] of all) {
      const a = source.getBoundingClientRect();
      const b = mirrored.getBoundingClientRect();
      if (source.getClientRects().length === 0 && mirrored.getClientRects().length === 0) continue;
      const name = `${source.localName}.${String(source.getAttribute("class") ?? "").split(" ")[0]}`;
      const off = Math.max(
        Math.abs((a.left - here.left) * ratio - (b.left - there.left)), Math.abs((a.top - here.top) * ratio - (b.top - there.top)),
        Math.abs(a.width * ratio - b.width), Math.abs(a.height * ratio - b.height),
      );
      if (off > TOLERANCE) return `${name} is ${off.toFixed(1)}px off in the mirror (${Math.round(a.width * ratio)}×${Math.round(a.height * ratio)} vs ${Math.round(b.width)}×${Math.round(b.height)})`;
      const [was, now] = [getComputedStyle(source), getComputedStyle(mirrored)];
      const look = LOOKS.find((prop) => was.getPropertyValue(prop) !== now.getPropertyValue(prop));
      if (look) return `${name} has ${look} ${now.getPropertyValue(look)} in the mirror, ${was.getPropertyValue(look)} on the island`;
    }
    return null;
  } finally {
    host.remove();
    await act(async () => {
      endBarMirrorWatch();
    });
  }
}
