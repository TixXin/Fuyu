import { compileErrorSummary, type CompileErrorInput } from "./lib/devCompileError";
import "./devCompileError.css";

const FLAG = "devCompileError";
let node: HTMLElement | null = null;

function part(className: string, content: string) {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = content;
  return element;
}

export function showCompileError(error: CompileErrorInput) {
  const { where, message } = compileErrorSummary(error);
  const island = new URLSearchParams(window.location.search).get("window") === null;
  if (!node) {
    node = document.createElement("div");
    node.setAttribute("role", "alert");
    document.body.appendChild(node);
  }
  node.className = `dev-compile-error dev-compile-error--${island ? "island" : "window"}`;
  node.title = where ? `${where}\n${message}` : message;
  node.replaceChildren(...(where ? [part("dev-compile-error__where", where)] : []), part("dev-compile-error__message", message));
  document.documentElement.dataset[FLAG] = "true";
}

export function clearCompileError() {
  node?.remove();
  node = null;
  delete document.documentElement.dataset[FLAG];
}

if (import.meta.hot) {
  import.meta.hot.on("vite:error", (payload) => showCompileError(payload.err));
  import.meta.hot.on("vite:beforeUpdate", clearCompileError);
  import.meta.hot.on("vite:beforeFullReload", clearCompileError);
}
