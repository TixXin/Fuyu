import type { TodoDefaultPriority, TodoDoneDisplay, TodoDueReminderScope, TodoInsertPosition, TodoSortBy } from "../../../features/todos/todoPrefs";

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
  defaultProject: string;
  defaultProjectHint: string;
  defaultProjectInbox: string;
  defaultPriority: string;
  defaultPriorityHint: string;
  defaultPriorityOptions: Record<TodoDefaultPriority, string>;
  focusGroup: string;
  focusTimer: string;
  focusTimerHint: string;
  focusTimerPluginOffHint: string;
  focusTimerPluginOff: string;
  enableTimerPlugin: string;
  focusTimerMinutes: string;
  timedReminder: string;
  timedReminderHint: string;
  timedReminderLead: string;
  timedReminderLeadOnTime: string;
  timedReminderLeadMinutes: (minutes: number) => string;
  dueReminderScope: string;
  dueReminderScopeHint: string;
  dueReminderScopeOptions: Record<TodoDueReminderScope, string>;
  wrapUpReminder: string;
  wrapUpReminderHint: string;
  wrapUpReminderTime: string;
  autoCompleteFromSubtasks: string;
  autoCompleteFromSubtasksHint: string;
  rolloverGroup: string;
  completionSound: string;
  dayStartHour: string;
  dayStartHourHint: string;
  dayStartMidnight: string;
  doneDisplay: string;
  doneDisplayOptions: Record<TodoDoneDisplay, string>;
  markdownMeta: string;
  markdownMetaOptions: { project: string; priority: string; subtasks: string; note: string; elapsed: string };
  archiveRetention: string;
  archiveRetentionHint: string;
  archiveRetentionOptions: { forever: string; days90: string; days180: string; days365: string };
  showWeekSummary: string;
  showWeekSummaryHint: string;
  carryOverIncomplete: string;
  recurrenceHolidayAware: string;
  recurrenceHolidayAwareHint: string;
  noteTemplate: string;
  noteTemplateHint: string;
  noteTemplatePlaceholder: string;
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
  defaultProject: "新待办默认进哪个项目",
  defaultProjectHint: "在「全部」下新建的待办进这个项目。筛选了某个项目时进那个项目，开头写 #名字 的以写的为准。",
  defaultProjectInbox: "临时",
  defaultPriority: "新待办默认优先级",
  defaultPriorityHint: "行内写了 !1–!3 的以写的为准。",
  defaultPriorityOptions: {
    none: "无",
    low: "低",
    medium: "中",
    high: "高",
  },
  focusGroup: "专注联动与提醒",
  focusTimer: "开始任务时启动专注倒计时",
  focusTimerHint: "点击待办的「开始」时自动拉起倒计时，到点后自动累加到该待办的专注时长。",
  focusTimerPluginOffHint: "内置「计时器」插件当前未开启，启用后即可联动专注倒计时与准点提醒。",
  focusTimerPluginOff: "需要启用内置「计时器」插件才能启动专注倒计时与岛上提醒。",
  enableTimerPlugin: "启用计时器",
  focusTimerMinutes: "专注时长（分钟）",
  timedReminder: "带时刻（HH:mm）的待办到点提醒",
  timedReminderHint: "今日标题以时刻开头（如 15:00 回电话）且未完成的待办，到点弹出岛屿提醒横幅并支持推迟。",
  timedReminderLead: "提前提醒",
  timedReminderLeadOnTime: "准点",
  timedReminderLeadMinutes: (minutes) => `提前 ${minutes} 分钟`,
  dueReminderScope: "到期提醒哪些待办",
  dueReminderScopeHint: "已安排的待办到了那天、并进今天的列表时，在岛上提醒一次。",
  dueReminderScopeOptions: {
    off: "不提醒",
    high: "只高优先级",
    highMedium: "高和中优先级",
    all: "全部",
  },
  wrapUpReminder: "每天收尾提醒",
  wrapUpReminderHint: "到点还有没做完的待办时，在岛上提醒一次。都做完了不提醒。",
  wrapUpReminderTime: "提醒时间",
  autoCompleteFromSubtasks: "子任务全部勾选后自动完成主待办",
  autoCompleteFromSubtasksHint: "当至少有一项子步骤且最后一项被勾选完成时，自动将主待办标记为已完成。",
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
    project: "项目名",
    priority: "优先级标记",
    subtasks: "子任务",
    note: "备注",
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
  showWeekSummary: "归档页显示本周小结",
  showWeekSummaryHint: "归档页最上面的一张卡：本周完成几件、每天一根小柱、专注时长最多的项目。",
  carryOverIncomplete: "自动将未完成任务写入下一天",
  recurrenceHolidayAware: "「工作日」重复按调休算",
  recurrenceHolidayAwareHint: "补班日照常出现，法定假日不出现。要日历里有节假日数据；关掉后只按周一到周五算。",
  noteTemplate: "每日笔记的开头",
  noteTemplateHint: "新的一天开始时先填进每日笔记，从下一个新的一天起生效。只有这段、没写别的内容的笔记不会存成文件。",
  noteTemplatePlaceholder: "例如：今天最重要的三件事",
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
  defaultProject: "Default project for new tasks",
  defaultProjectHint: "Tasks added under All go to this project. With a project filter on they go to that project, and a leading #name always wins.",
  defaultProjectInbox: "Inbox",
  defaultPriority: "Default priority for new tasks",
  defaultPriorityHint: "An inline !1–!3 always wins.",
  defaultPriorityOptions: {
    none: "None",
    low: "Low",
    medium: "Medium",
    high: "High",
  },
  focusGroup: "Focus timer & reminders",
  focusTimer: "Start focus timer when starting a task",
  focusTimerHint: "Starts a countdown via the built-in timer when you click Start on a task, and credits focus minutes when due.",
  focusTimerPluginOffHint: "The built-in Timer plugin is currently off; enable it to use focus countdowns and timed reminders.",
  focusTimerPluginOff: "Enable the built-in Timer plugin to run focus timers and island reminders.",
  enableTimerPlugin: "Enable Timer",
  focusTimerMinutes: "Focus duration (minutes)",
  timedReminder: "Remind at scheduled time (HH:mm)",
  timedReminderHint: "Shows an island reminder banner with snooze when an unfinished task starting with HH:mm reaches its time.",
  timedReminderLead: "Remind ahead",
  timedReminderLeadOnTime: "On time",
  timedReminderLeadMinutes: (minutes) => `${minutes} min before`,
  dueReminderScope: "Remind when scheduled tasks are due",
  dueReminderScopeHint: "Shows one island reminder when a scheduled task reaches its day and joins today's list.",
  dueReminderScopeOptions: {
    off: "Never",
    high: "High priority only",
    highMedium: "High and medium",
    all: "All",
  },
  wrapUpReminder: "End-of-day reminder",
  wrapUpReminderHint: "Shows one island reminder at the set time if tasks are still open. Stays quiet when everything is done.",
  wrapUpReminderTime: "Remind at",
  autoCompleteFromSubtasks: "Complete main task when all subtasks are checked",
  autoCompleteFromSubtasksHint: "Automatically marks the parent task done once its last remaining subtask is checked off.",
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
    project: "Project",
    priority: "Priority",
    subtasks: "Subtasks",
    note: "Notes",
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
  showWeekSummary: "Show the week summary on the archive page",
  showWeekSummaryHint: "A card at the top of the archive: tasks done this week, a bar per day and the projects with the most focus time.",
  carryOverIncomplete: "Carry unfinished tasks to next day",
  recurrenceHolidayAware: "Weekday repeats follow public holidays",
  recurrenceHolidayAwareHint: "Shows up on make-up workdays and skips public holidays. Needs holiday data in the calendar; when off, only Monday to Friday counts.",
  noteTemplate: "Daily note starter",
  noteTemplateHint: "Fills the daily note when a new day starts, from the next new day on. A note with only this text is not saved as a file.",
  noteTemplatePlaceholder: "For example: the three things that matter most today",
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
