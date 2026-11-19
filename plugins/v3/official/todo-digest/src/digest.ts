import type { DigestSettings, DigestTodo } from "./model.ts";
import type { DigestText } from "./text.ts";

function itemLine(todo: DigestTodo, settings: DigestSettings, t: DigestText): string {
  const label = todo.project ? `[${todo.project}] ${todo.title}` : todo.title;
  if (settings.format === "checkbox") return `- [${todo.completed ? "x" : " "}] ${label}`;
  return `- ${label}${todo.completed ? t.doneSuffix : ""}`;
}

export function buildDigest(todos: DigestTodo[], settings: DigestSettings, t: DigestText, clock: string): string | null {
  const open = todos.filter((todo) => !todo.completed);
  const done = todos.filter((todo) => todo.completed);
  if (open.length === 0 && !settings.writeWhenDone) return null;

  const header = settings.scope === "open" ? t.headerOpen(clock, open.length) : t.headerCount(clock, open.length, done.length);
  const items = settings.scope === "all" ? [...open, ...done] : open;
  const lines = [header, ...items.map((todo) => itemLine(todo, settings, t))];
  if (open.length === 0) lines.push(todos.length === 0 ? t.noTodos : t.allDone);
  return lines.join("\n");
}

export function placeBlock(note: string, block: string, previous: string | null): { note: string; replaced: boolean } {
  if (previous) {
    const at = note.lastIndexOf(previous);
    if (at >= 0) {
      return { note: `${note.slice(0, at)}${block}${note.slice(at + previous.length)}`, replaced: true };
    }
  }
  const trimmed = note.trimEnd();
  return { note: trimmed.length > 0 ? `${trimmed}\n\n${block}` : block, replaced: false };
}
