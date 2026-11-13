import type { ClutterWindow } from "../../stage/Clutter";
import type { Format } from "../../stage/stageState";
import type { Lang } from "../types";
import { copyFor } from "./copy";

export function windows(lang: Lang, format: Format): ClutterWindow[] {
  const copy = copyFor(lang);
  const [terminal, ...terminalLines] = copy.terminal;
  const [docs, ...docLines] = copy.docs;
  const [after, ...afterLines] = copy.terminalAfter;
  if (format === "vertical") {
    return [
      { id: "terminal", kind: "terminal", title: terminal, badge: "!", x: 36, y: 250, width: 500, height: 250, tilt: 0, lines: terminalLines },
      { id: "docs", kind: "mail", title: docs, x: 180, y: 400, width: 500, height: 290, tilt: 0, lines: docLines },
      { id: "after", kind: "terminal", title: after, x: 60, y: 300, width: 600, height: 300, tilt: 0, lines: afterLines, frontOnly: true },
    ];
  }
  return [
    { id: "terminal", kind: "terminal", title: terminal, badge: "!", x: 210, y: 210, width: 560, height: 300, tilt: 0, lines: terminalLines },
    { id: "docs", kind: "mail", title: docs, x: 470, y: 290, width: 600, height: 330, tilt: 0, lines: docLines },
    { id: "after", kind: "terminal", title: after, x: 330, y: 230, width: 620, height: 320, tilt: 0, lines: afterLines, frontOnly: true },
  ];
}
