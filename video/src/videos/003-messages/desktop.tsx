import mailIcon from "../../../../src/assets/brands/mail.png";
import qqIcon from "../../../../src/assets/brands/qq.png";
import wechatIcon from "../../../../src/assets/brands/wechat.png";
import type { CodeLine, DesktopWindow } from "../../stage/desktop/AppWindow";
import { WindowsDesktop } from "../../stage/desktop/WindowsDesktop";
import type { Format } from "../../stage/stageState";
import type { Lang } from "../types";
import { copyFor } from "./copy";
import wallpaper from "./wallpaper.jpg";

const CODE: CodeLine[] = [
  { parts: [["key", "import"], ["plain", " { "], ["name", "normalize"], ["plain", " } "], ["key", "from"], ["text", " \"./text\""], ["plain", ";"]] },
  { parts: [] },
  { parts: [["key", "export function "], ["name", "searchClips"], ["plain", "(items: Clip[], query: "], ["name", "string"], ["plain", ") {"]] },
  { indent: 1, parts: [["key", "const "], ["plain", "words = "], ["name", "normalize"], ["plain", "(query)."], ["name", "split"], ["plain", "("], ["text", "\" \""], ["plain", ");"]] },
  { indent: 1, parts: [["key", "if "], ["plain", "(words.length === "], ["num", "0"], ["plain", ") "], ["key", "return "], ["plain", "items;"]] },
  { indent: 1, parts: [["key", "return "], ["plain", "items."], ["name", "filter"], ["plain", "((item) => {"]] },
  { indent: 2, parts: [["key", "const "], ["plain", "text = "], ["name", "normalize"], ["plain", "(item.preview + "], ["text", "\" \""], ["plain", " + (item.note ?? "], ["text", "\"\""], ["plain", "));"]] },
  { indent: 2, parts: [["key", "return "], ["plain", "words."], ["name", "every"], ["plain", "((word) => text."], ["name", "includes"], ["plain", "(word));"]] },
  { indent: 1, parts: [["plain", "});"]] },
  { parts: [["plain", "}"]] },
  { parts: [] },
  { parts: [["key", "export function "], ["name", "rankClips"], ["plain", "(items: Clip[]) {"]] },
  { indent: 1, parts: [["key", "return "], ["plain", "[...items]."], ["name", "sort"], ["plain", "((a, b) => b.copiedAt - a.copiedAt);"]] },
  { parts: [["plain", "}"]] },
];

const FILES = ["api.ts", "search.ts", "ClipboardPanel.tsx", "ClipboardPanel.css", "storage.ts", "useClipboard.ts"];

export function desktop(lang: Lang, format: Format) {
  const copy = copyFor(lang);
  const place = format === "vertical"
    ? { editor: { x: 20, y: 150, width: 600, height: 400 }, browser: { x: 110, y: 400, width: 590, height: 420 } }
    : { editor: { x: 64, y: 92, width: 760, height: 520 }, browser: { x: 560, y: 150, width: 660, height: 500 } };
  const windows: DesktopWindow[] = [
    { id: "editor", kind: "editor", title: copy.editorTitle, files: FILES, tabs: ["search.ts", "api.ts"], code: CODE, status: copy.editorStatus, ...place.editor },
    { id: "browser", kind: "browser", title: "", ...copy.browser, ...place.browser },
  ];
  return (
    <WindowsDesktop
      wallpaper={wallpaper}
      windows={windows}
      apps={[
        { id: "folder", icon: "folder" },
        { id: "browser", icon: "browser", running: true, focused: true },
        { id: "editor", icon: "editor", running: true },
        { id: "qq", icon: { image: qqIcon }, running: true, badge: { count: 3, order: 0 } },
        { id: "wechat", icon: { image: wechatIcon }, running: true, badge: { count: 2, order: 1 } },
        { id: "mail", icon: { image: mailIcon }, running: true, badge: { count: 1, order: 2 } },
      ]}
    />
  );
}
