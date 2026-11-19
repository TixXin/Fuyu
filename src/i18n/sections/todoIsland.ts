import type { TodoColor, TodoPriority, TodoRecurrenceKind } from "../../features/todos/types";

export type TodoIslandText = {
  tabsLabel: string;
  today: string;
  tomorrow: string;
  note: string;
  upcoming: string;
  archive: string;
  openCount: (count: number) => string;
  addPlaceholder: string;
  addPlaceholderFor: (date: string) => string;
  emptyTitle: string;
  emptyHint: string;
  allDoneTitle: string;
  allDoneHint: string;
  notePlaceholder: string;
  save: { idle: string; saving: string; saved: string; needsPath: string; error: string };
  backToArchive: string;
  doneOf: (done: number, total: number) => string;
  noArchives: string;
  noArchiveTasks: string;
  inProgress: string;
  inProgressElapsed: (elapsed: string) => string;
  todayDone: (done: number, total: number) => string;
  clearDone: (count: number) => string;
  doneSection: (count: number) => string;
  projectFilter: string;
  allProjects: string;
  noProject: string;
  projectHint: string;
  newProject: string;
  newProjectPlaceholder: string;
  addToProject: (project: string) => string;
  projectCount: (project: string, open: number) => string;
  subtaskProgress: (done: number, total: number) => string;
  hasNote: string;
  addSubtaskPlaceholder: string;
  itemNotePlaceholder: string;
  itemNoteLabel: string;
  tags: {
    menu: (title: string) => string;
    priority: Record<TodoPriority, string>;
    noPriority: string;
    color: Record<TodoColor, string>;
    noColor: string;
    recurrence: Record<TodoRecurrenceKind, string>;
    noRecurrence: string;
    dueTitle: string;
    dueTitleAny: string;
  };
  reminders: {
    ahead: (minutes: number) => string;
    wrapUp: (openCount: number) => string;
  };
};

export const zhCN: TodoIslandText = {
  tabsLabel: "待办页面",
  today: "今天",
  tomorrow: "明天",
  note: "笔记",
  upcoming: "已安排",
  archive: "归档",
  openCount: (count) => `${count} 个未完成`,
  addPlaceholder: "添加待办，回车保存",
  addPlaceholderFor: (date) => `添加 ${date} 的待办`,
  emptyTitle: "今天还很轻",
  emptyHint: "在上面输入一件事，回车添加",
  allDoneTitle: "今天的待办都做完了",
  allDoneHint: "在上面继续添加，或去归档回看",
  notePlaceholder: "写点今天的笔记…",
  save: {
    idle: "保存今天的清单为 Markdown",
    saving: "正在保存…",
    saved: "已保存",
    needsPath: "还没设置保存位置，点这里去设置",
    error: "保存失败，点这里重试",
  },
  backToArchive: "返回归档",
  doneOf: (done, total) => `完成 ${done}/${total}`,
  noArchives: "还没有保存过的清单",
  noArchiveTasks: "这天没有记下待办",
  inProgress: "进行中",
  inProgressElapsed: (elapsed) => `进行中 · ${elapsed}`,
  todayDone: (done, total) => `今天完成 ${done}/${total}`,
  clearDone: (count) => (count > 0 ? `清除已完成（${count} 件）` : "清除已完成"),
  doneSection: (count) => `已完成 ${count}`,
  projectFilter: "按项目筛选",
  allProjects: "全部",
  noProject: "临时",
  projectHint: "开头写 #项目名 加空格，就归到这个项目，例如「#论文 写引言」；没有的项目会新建",
  newProject: "新建项目",
  newProjectPlaceholder: "项目名，回车保存",
  addToProject: (project) => `新待办加到「${project}」`,
  projectCount: (project, open) => `${project}，${open} 件未完成`,
  subtaskProgress: (done, total) => `子步骤已完成 ${done}/${total}`,
  hasNote: "含备注",
  addSubtaskPlaceholder: "添加子步骤，回车继续",
  itemNotePlaceholder: "添加一行简短备注…",
  itemNoteLabel: "任务备注",
  tags: {
    menu: (title) => `「${title}」的优先级、颜色和重复`,
    priority: { high: "高优先级", medium: "中优先级", low: "低优先级" },
    noPriority: "不设优先级",
    color: { red: "红色", orange: "橙色", yellow: "黄色", green: "绿色", blue: "蓝色", purple: "紫色" },
    noColor: "不设颜色",
    recurrence: { daily: "每天重复", workdays: "法定工作日重复", weekly: "每周重复", monthly: "每月重复" },
    noRecurrence: "取消重复",
    dueTitle: "高优先级待办今天到期",
    dueTitleAny: "已安排的待办今天到期",
  },
  reminders: {
    ahead: (minutes) => `${minutes} 分钟后`,
    wrapUp: (openCount) => `今天还有 ${openCount} 件没做完`,
  },
};

export const en: TodoIslandText = {
  tabsLabel: "Todo pages",
  today: "Today",
  tomorrow: "Tomorrow",
  note: "Note",
  upcoming: "Upcoming",
  archive: "Archive",
  openCount: (count) => `${count} open`,
  addPlaceholder: "Add a task, press Enter",
  addPlaceholderFor: (date) => `Add a task for ${date}`,
  emptyTitle: "A light day so far",
  emptyHint: "Type a task above and press Enter",
  allDoneTitle: "All done for today",
  allDoneHint: "Add another task above, or check the archive",
  notePlaceholder: "Notes for today…",
  save: {
    idle: "Save today's list as Markdown",
    saving: "Saving…",
    saved: "Saved",
    needsPath: "No save folder yet; click to set one",
    error: "Could not save; click to try again",
  },
  backToArchive: "Back to the archive",
  doneOf: (done, total) => `${done} of ${total} done`,
  noArchives: "No saved lists yet",
  noArchiveTasks: "No tasks were written down",
  inProgress: "In progress",
  inProgressElapsed: (elapsed) => `In progress · ${elapsed}`,
  todayDone: (done, total) => `${done} of ${total} done today`,
  clearDone: (count) => (count > 0 ? `Clear done (${count})` : "Clear done"),
  doneSection: (count) => `Done ${count}`,
  projectFilter: "Filter by project",
  allProjects: "All",
  noProject: "Inbox",
  projectHint: "Start with #name and a space to put it in a project, such as \"#thesis Write the intro\"; a new name makes a new project",
  newProject: "New project",
  newProjectPlaceholder: "Project name, Enter to save",
  addToProject: (project) => `New tasks go to ${project}`,
  projectCount: (project, open) => `${project}, ${open} open`,
  subtaskProgress: (done, total) => `${done} of ${total} subtasks done`,
  hasNote: "Has note",
  addSubtaskPlaceholder: "Add a step, press Enter",
  itemNotePlaceholder: "Add a short note…",
  itemNoteLabel: "Task note",
  tags: {
    menu: (title) => `Priority, color and repeat of ${title}`,
    priority: { high: "High priority", medium: "Medium priority", low: "Low priority" },
    noPriority: "No priority",
    color: { red: "Red", orange: "Orange", yellow: "Yellow", green: "Green", blue: "Blue", purple: "Purple" },
    noColor: "No color",
    recurrence: { daily: "Repeat daily", workdays: "Repeat on workdays", weekly: "Repeat weekly", monthly: "Repeat monthly" },
    noRecurrence: "Do not repeat",
    dueTitle: "High-priority task due today",
    dueTitleAny: "Scheduled task due today",
  },
  reminders: {
    ahead: (minutes) => `In ${minutes} min`,
    wrapUp: (openCount) => (openCount === 1 ? "1 task still open today" : `${openCount} tasks still open today`),
  },
};
