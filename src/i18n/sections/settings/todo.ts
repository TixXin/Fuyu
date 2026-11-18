import type { TodoDoneDisplay, TodoInsertPosition, TodoSortBy } from "../../../features/todos/todoPrefs";

export type SettingsTodoText = {
  title: string;
  displayGroup: string;
  showElapsed: string;
  showElapsedHint: string;
  sortBy: string;
  sortOptions: Record<TodoSortBy, string>;
  inputGroup: string;
  inlineSyntax: string;
  inlineSyntaxHint: string;
  insertPosition: string;
  insertOptions: Record<TodoInsertPosition, string>;
  rolloverGroup: string;
  completionSound: string;
  dayStartHour: string;
  dayStartHourHint: string;
  dayStartMidnight: string;
  doneDisplay: string;
  doneDisplayOptions: Record<TodoDoneDisplay, string>;
  markdownMeta: string;
  markdownMetaOptions: { priority: string; elapsed: string };
  archiveRetention: string;
  archiveRetentionHint: string;
  archiveRetentionOptions: { forever: string; days90: string; days180: string; days365: string };
  carryOverIncomplete: string;
  enableReorder: string;
  rotateTodos: string;
  rotationSeconds: string;
  projects: string;
  projectsHint: string;
  projectsEmpty: string;
  newProject: string;
  addProject: string;
  projectName: (name: string) => string;
  moveUp: (name: string) => string;
  moveDown: (name: string) => string;
  removeProject: (name: string) => string;
};

export const zhCN: SettingsTodoText = {
  title: "任务",
  displayGroup: "小岛显示与排序",
  showElapsed: "显示进行中已用时长",
  showElapsedHint: "在待办列表和收起的小岛上显示已开始时长，例如 18m。",
  sortBy: "列表排序方式",
  sortOptions: {
    manual: "手动顺序",
    priority: "优先级优先（高 → 低）",
    createdDesc: "创建时间（新 → 旧）",
  },
  inputGroup: "快速录入与轻语法",
  inlineSyntax: "行内快捷语法识别",
  inlineSyntaxHint: "回车添加时自动识别并剥离 #项目、!1–!3（或 p1–p3）优先级与 @明天 / @下周一 / @MM-DD 日期。",
  insertPosition: "新建待办插入位置",
  insertOptions: {
    bottom: "列表底部",
    top: "列表顶部",
  },
  rolloverGroup: "反馈与跨天归档",
  completionSound: "勾选完成时播放轻音效",
  dayStartHour: "新一天开始时间",
  dayStartHourHint: "到这个时间才把前一天归档并开启新清单，避免熬夜过零点提前翻篇。",
  dayStartMidnight: "00:00（午夜）",
  doneDisplay: "已完成任务显示方式",
  doneDisplayOptions: {
    fold: "收起在底部折叠栏",
    inline: "保持原位划掉",
    hide: "从今日列表隐藏",
  },
  markdownMeta: "Markdown 导出附带信息",
  markdownMetaOptions: {
    priority: "优先级标记",
    elapsed: "已用时长",
  },
  archiveRetention: "应用内归档保留时长",
  archiveRetentionHint: "只裁剪应用内归档列表，不会删除已保存到文件夹的 Markdown 文件。",
  archiveRetentionOptions: {
    forever: "永久保留",
    days90: "90 天",
    days180: "180 天",
    days365: "1 年",
  },
  carryOverIncomplete: "自动将未完成任务写入下一天",
  enableReorder: "允许拖动调整任务顺序",
  rotateTodos: "多任务流动",
  rotationSeconds: "每个任务停留时间（秒）",
  projects: "项目",
  projectsHint: "待办页的筛选条和新建待办时可选这些项目，没选项目的待办归「临时」。改名会连同计划中和历史归档里的待办一起改，已保存的每日 Markdown 会重写；删除项目后，它今天和计划中的待办归到「临时」，历史归档不变。",
  projectsEmpty: "还没有项目。在下面输入名字，或在待办页点筛选条上的 +。",
  newProject: "新项目名，回车添加",
  addProject: "添加",
  projectName: (name) => `项目「${name}」的名字`,
  moveUp: (name) => `上移「${name}」`,
  moveDown: (name) => `下移「${name}」`,
  removeProject: (name) => `删除项目「${name}」`,
};

export const en: SettingsTodoText = {
  title: "Tasks",
  displayGroup: "Island display & sorting",
  showElapsed: "Show elapsed time while in progress",
  showElapsedHint: "Displays how long an active task has been running on its row and the collapsed bar.",
  sortBy: "Task sort order",
  sortOptions: {
    manual: "Manual order",
    priority: "Priority (high to low)",
    createdDesc: "Created time (newest first)",
  },
  inputGroup: "Quick entry & inline syntax",
  inlineSyntax: "Inline quick syntax",
  inlineSyntaxHint: "Extracts and strips #project, !1–!3 (or p1–p3) priority and @tomorrow or @MM-DD dates on Enter.",
  insertPosition: "Insert new tasks at",
  insertOptions: {
    bottom: "Bottom",
    top: "Top",
  },
  rolloverGroup: "Feedback & daily rollover",
  completionSound: "Play subtle sound on completion",
  dayStartHour: "New day starts at",
  dayStartHourHint: "Waits until this hour before archiving yesterday's list, so late-night work stays on today.",
  dayStartMidnight: "00:00 (midnight)",
  doneDisplay: "Completed tasks",
  doneDisplayOptions: {
    fold: "Folded at bottom",
    inline: "Crossed out in place",
    hide: "Hide from today's list",
  },
  markdownMeta: "Include in Markdown export",
  markdownMetaOptions: {
    priority: "Priority",
    elapsed: "Elapsed time",
  },
  archiveRetention: "Keep in-app archives for",
  archiveRetentionHint: "Trims older entries in the app's archive list without deleting saved Markdown files.",
  archiveRetentionOptions: {
    forever: "Forever",
    days90: "90 days",
    days180: "180 days",
    days365: "1 year",
  },
  carryOverIncomplete: "Carry unfinished tasks to next day",
  enableReorder: "Drag to reorder tasks",
  rotateTodos: "Rotate through pending tasks",
  rotationSeconds: "Time per task (seconds)",
  projects: "Projects",
  projectsHint: "The todo page's filter and new tasks offer these projects; a task without one is in the Inbox. Renaming one renames it in planned tasks and the archive too, and saved daily Markdown is written again; removing one moves its tasks of today and later to the Inbox and leaves the archive as it was.",
  projectsEmpty: "No projects yet. Type a name below, or press + on the todo page's filter.",
  newProject: "New project name, Enter to add",
  addProject: "Add",
  projectName: (name) => `Name of ${name}`,
  moveUp: (name) => `Move ${name} up`,
  moveDown: (name) => `Move ${name} down`,
  removeProject: (name) => `Remove ${name}`,
};
