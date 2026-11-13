import type { ClutterWindow } from "../../stage/Clutter";
import type { Format } from "../../stage/stageState";
import type { Lang } from "../types";
import { copyFor } from "./copy";

export function windows(lang: Lang, format: Format): ClutterWindow[] {
  const text = copyFor(lang).windows;
  const [chat, ...chatLines] = text.chat;
  const [mail, ...mailLines] = text.mail;
  const [music, ...musicLines] = text.music;
  const [terminal, ...terminalLines] = text.terminal;
  const [notes, ...noteLines] = text.notes;
  const [translate, ...translateLines] = text.translate;
  const [clipboard, ...clipboardLines] = text.clipboard;
  if (format === "vertical") {
    return [
      { id: "notes", kind: "notes", title: notes, x: 30, y: 150, width: 300, height: 214, tilt: -2.2, lines: noteLines },
      { id: "music", kind: "music", title: music, x: 380, y: 110, width: 310, height: 148, tilt: 1.6, lines: musicLines },
      { id: "chat", kind: "chat", title: chat, badge: "3", x: 200, y: 300, width: 330, height: 196, tilt: 0.8, lines: chatLines },
      { id: "mail", kind: "mail", title: mail, badge: "1", x: 30, y: 520, width: 360, height: 172, tilt: 1.4, lines: mailLines },
      { id: "clipboard", kind: "clipboard", title: clipboard, x: 410, y: 450, width: 280, height: 166, tilt: -1.4, lines: clipboardLines },
      { id: "translate", kind: "translate", title: translate, x: 330, y: 650, width: 330, height: 136, tilt: -0.8, lines: translateLines },
      { id: "terminal", kind: "terminal", title: terminal, badge: "!", x: 150, y: 390, width: 380, height: 180, tilt: 0.6, lines: terminalLines },
    ];
  }
  return [
    { id: "notes", kind: "notes", title: notes, x: 96, y: 150, width: 300, height: 214, tilt: -2.2, lines: noteLines },
    { id: "music", kind: "music", title: music, x: 820, y: 96, width: 350, height: 148, tilt: 1.6, lines: musicLines },
    { id: "chat", kind: "chat", title: chat, badge: "3", x: 430, y: 196, width: 330, height: 196, tilt: 0.8, lines: chatLines },
    { id: "mail", kind: "mail", title: mail, badge: "1", x: 150, y: 400, width: 360, height: 172, tilt: 1.4, lines: mailLines },
    { id: "clipboard", kind: "clipboard", title: clipboard, x: 880, y: 300, width: 290, height: 166, tilt: -1.4, lines: clipboardLines },
    { id: "translate", kind: "translate", title: translate, x: 560, y: 430, width: 330, height: 136, tilt: -0.8, lines: translateLines },
    { id: "terminal", kind: "terminal", title: terminal, badge: "!", x: 700, y: 240, width: 380, height: 180, tilt: 0.6, lines: terminalLines },
  ];
}
