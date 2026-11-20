const LABELS = {
  note: { "zh-CN": "放进今日笔记", en: "Add to today's note" },
  todo: { "zh-CN": "建成待办", en: "Make a todo" },
  noted: { "zh-CN": "已放进今日笔记", en: "Added to today's note" },
  added: { "zh-CN": "已建成待办", en: "Todo added" },
  shot: { "zh-CN": "截图", en: "Screenshot" },
};
const MAX_TITLE = 120;

const pick = (text, locale) => (locale === "en" ? text.en : text["zh-CN"]);

export function imageLine(path, locale) {
  return `![${pick(LABELS.shot, locale)}](<${path.replace(/[<>\r\n]/g, "")}>)`;
}

export function todoTitle(context, now = new Date()) {
  const from = context.source?.title || context.source?.app;
  if (from) return `${pick(LABELS.shot, context.locale)}: ${from}`.slice(0, MAX_TITLE);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `${pick(LABELS.shot, context.locale)} ${time}`;
}

export function registerTodoScreenshotActions(actions, call) {
  const offNote = actions.register({
    id: "todos.note",
    label: LABELS.note,
    icon: "notebook",
    order: 30,
    keeps: true,
    run: async (context) => {
      await call("setNote", { append: imageLine(context.path, context.locale) });
      return { message: pick(LABELS.noted, context.locale), dismiss: true };
    },
  });
  const offTodo = actions.register({
    id: "todos.todo",
    label: LABELS.todo,
    icon: "list-todo",
    order: 31,
    keeps: true,
    run: async (context) => {
      await call("add", { title: todoTitle(context), note: imageLine(context.path, context.locale) });
      return { message: pick(LABELS.added, context.locale), dismiss: true };
    },
  });
  return () => {
    offNote();
    offTodo();
  };
}
