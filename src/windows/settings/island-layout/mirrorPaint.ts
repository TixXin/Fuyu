import DOMPurify from "dompurify";
import { MIRROR_SHEET } from "../../../features/plugin-kernel/barMirror";

const LINKS = /^(?:(?:https?|asset|tauri|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

export function paintMirror(host: HTMLElement, html: string) {
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  const sheet = document.createElement("style");
  sheet.textContent = MIRROR_SHEET;
  root.replaceChildren(sheet, DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true, ALLOWED_URI_REGEXP: LINKS }));
  return root;
}
