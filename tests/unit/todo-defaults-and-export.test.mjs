import assert from "node:assert/strict";
import test from "node:test";
import { formatTodosAsMarkdown, getTodoSignature, todoMarkdownOptions } from "../../src/features/todos/markdown.ts";
import { composerTarget, defaultProjectName, hasNoteContent, newTodoPriority } from "../../src/features/todos/newTodoDefaults.ts";
import { DEFAULT_TODO_PREFS, MAX_NOTE_TEMPLATE_LENGTH, normalizeTodoPrefs } from "../../src/features/todos/todoPrefs.ts";

const DATE = "2026-11-18";
const todo = {
  id: "1",
  title: "写引言",
  completed: false,
  createdAt: 1,
  project: "论文",
  priority: "high",
  note: "先列提纲",
  subtasks: [{ id: "s1", title: "查文献", completed: true }],
};
const exportWith = (changes) => todoMarkdownOptions({ ...DEFAULT_TODO_PREFS, ...changes });

test("the new todo prefs default to what the app did before and drop values it cannot use", () => {
  const fromOldVersion = normalizeTodoPrefs({ markdownPriority: false, markdownElapsed: true });
  assert.equal(fromOldVersion.defaultProject, "");
  assert.equal(fromOldVersion.defaultPriority, "none");
  assert.equal(fromOldVersion.recurrenceHolidayAware, true);
  assert.equal(fromOldVersion.noteTemplate, "");
  assert.equal(fromOldVersion.markdownProject, true);
  assert.equal(fromOldVersion.markdownSubtasks, true);
  assert.equal(fromOldVersion.markdownNote, true);
  assert.equal(fromOldVersion.markdownPriority, false);
  assert.equal(fromOldVersion.markdownElapsed, true);

  const saved = normalizeTodoPrefs({
    defaultProject: " p-2 ",
    defaultPriority: "medium",
    recurrenceHolidayAware: false,
    noteTemplate: "今天最重要的三件事\n1. ",
    markdownProject: false,
    markdownSubtasks: false,
    markdownNote: false,
  });
  assert.equal(saved.defaultProject, "p-2");
  assert.equal(saved.defaultPriority, "medium");
  assert.equal(saved.recurrenceHolidayAware, false);
  assert.equal(saved.noteTemplate, "今天最重要的三件事\n1. ");
  assert.equal(saved.markdownProject, false);
  assert.equal(saved.markdownSubtasks, false);
  assert.equal(saved.markdownNote, false);

  const broken = normalizeTodoPrefs({ defaultProject: 7, defaultPriority: "urgent", recurrenceHolidayAware: "no", noteTemplate: ["x"], markdownNote: 0 });
  assert.equal(broken.defaultProject, "");
  assert.equal(broken.defaultPriority, "none");
  assert.equal(broken.recurrenceHolidayAware, true);
  assert.equal(broken.noteTemplate, "");
  assert.equal(broken.markdownNote, true);

  assert.equal(normalizeTodoPrefs({ noteTemplate: "字".repeat(MAX_NOTE_TEMPLATE_LENGTH + 50) }).noteTemplate.length, MAX_NOTE_TEMPLATE_LENGTH);
});

test("the default project follows the project through a rename and falls back to the inbox once it is gone", () => {
  const projects = [{ id: "p-1", name: "论文" }, { id: "p-2", name: "家里" }];

  assert.equal(defaultProjectName("", projects), undefined);
  assert.equal(defaultProjectName("p-2", projects), "家里");
  assert.equal(defaultProjectName("p-2", [projects[0], { id: "p-2", name: "家务" }]), "家务");
  assert.equal(defaultProjectName("p-2", [projects[0]]), undefined);
});

test("a new todo goes to the picked project, then the filtered one, then the default, then the inbox", () => {
  const projects = ["论文", "家里"];

  assert.equal(composerTarget({ picked: null, filter: null, projects }), "");
  assert.equal(composerTarget({ picked: null, filter: null, defaultProject: "家里", projects }), "家里");
  assert.equal(composerTarget({ picked: null, filter: "论文", defaultProject: "家里", projects }), "论文");
  assert.equal(composerTarget({ picked: "", filter: "论文", defaultProject: "家里", projects }), "");
  assert.equal(composerTarget({ picked: "论文", filter: null, defaultProject: "家里", projects }), "论文");
  assert.equal(composerTarget({ picked: null, filter: null, defaultProject: "已删除", projects }), "");
});

test("a priority written inline wins over the default priority", () => {
  assert.equal(newTodoPriority(undefined, "none"), undefined);
  assert.equal(newTodoPriority(undefined, "medium"), "medium");
  assert.equal(newTodoPriority("low", "high"), "low");
  assert.equal(newTodoPriority("high", "none"), "high");
});

test("the Markdown export writes the same lines as before by default and leaves out only what is switched off", () => {
  const all = "- [ ] [论文] [!高] 写引言\n  > 先列提纲\n  - [x] 查文献";

  assert.equal(formatTodosAsMarkdown([todo], exportWith({})), all);
  assert.equal(formatTodosAsMarkdown([todo], { markdownPriority: true }), all);
  assert.equal(formatTodosAsMarkdown([todo], exportWith({ markdownProject: false })), "- [ ] [!高] 写引言\n  > 先列提纲\n  - [x] 查文献");
  assert.equal(formatTodosAsMarkdown([todo], exportWith({ markdownNote: false })), "- [ ] [论文] [!高] 写引言\n  - [x] 查文献");
  assert.equal(formatTodosAsMarkdown([todo], exportWith({ markdownSubtasks: false })), "- [ ] [论文] [!高] 写引言\n  > 先列提纲");
  assert.equal(
    formatTodosAsMarkdown([todo], exportWith({ markdownProject: false, markdownPriority: false, markdownNote: false, markdownSubtasks: false })),
    "- [ ] 写引言",
  );
});

test("the saved-file signature stays what older versions stored and moves only with what the file contains", () => {
  const stored =
    '{"date":"2026-11-18","todos":[{"title":"写引言","completed":false,"project":"论文","note":"先列提纲","subtasks":[{"title":"查文献","completed":true}],"priority":"high"}],"dailyNote":""}';
  assert.equal(getTodoSignature(DATE, [todo], "", exportWith({})), stored);

  for (const key of ["markdownProject", "markdownNote", "markdownSubtasks"]) {
    assert.notEqual(getTodoSignature(DATE, [todo], "", exportWith({ [key]: false })), stored, key);
  }

  const withoutNotes = exportWith({ markdownNote: false });
  assert.equal(
    getTodoSignature(DATE, [todo], "", withoutNotes),
    getTodoSignature(DATE, [{ ...todo, note: "换一句" }], "", withoutNotes),
  );
  const withoutProjects = exportWith({ markdownProject: false });
  assert.equal(
    getTodoSignature(DATE, [todo], "", withoutProjects),
    getTodoSignature(DATE, [{ ...todo, project: "家里" }], "", withoutProjects),
  );
});

test("a daily note that holds only its starter text counts as empty", () => {
  const template = "今天最重要的三件事\n1. \n2. ";

  assert.equal(hasNoteContent("", template), false);
  assert.equal(hasNoteContent(template, template), false);
  assert.equal(hasNoteContent(`${template}\n`, template), false);
  assert.equal(hasNoteContent(`${template}\n3. 交报告`, template), true);
  assert.equal(hasNoteContent("随手记一句", template), true);
  assert.equal(hasNoteContent("随手记一句", ""), true);
  assert.equal(hasNoteContent("  \n", ""), false);
});
