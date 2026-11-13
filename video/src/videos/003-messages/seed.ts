import type { World } from "../../app/world";
import type { Lang } from "../types";
import { copyFor } from "./copy";

function today() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function seed(world: World, lang: Lang) {
  const copy = copyFor(lang);
  const now = Date.now();
  world.todos = {
    date: today(),
    todos: copy.todos.map((title, index) => ({ id: `t${index}`, title, completed: false, createdAt: now - index * 60_000 })),
    scheduled: [], archives: [], dailyNote: "", activeTodoId: null,
  };
  world.settings = { maxPanelHeight: 520 };
  world.mailBodies.m1 = { id: "m1", content: copy.mail.body, contentType: "text/plain", attachments: [] };
}
