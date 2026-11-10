export type NotebookText = {
  sectionLabel: string;
  addTaskHint: string;
  dailyNoteLabel: string;
  /** Start-up notice about moving the todos to todos.json. */
  dataNotice: { migrationFailed: string; reimported: string };
  dismissNotice: string;
  pickDate: string;
  dateToday: string;
  dateTomorrow: string;
  noScheduled: string;
  deleteScheduled: (title: string) => string;
};

export const zhCN: NotebookText = {
  sectionLabel: "任务清单",
  addTaskHint: "Add a task, press Enter to save",
  dailyNoteLabel: "Daily note",
  dataNotice: {
    migrationFailed: "待办数据迁移失败，已继续使用原数据。下次启动会再试。",
    reimported: "检测到旧版本修改过待办，已按旧版本的数据重新导入，之前的数据已备份在应用数据目录。",
  },
  dismissNotice: "知道了",
  pickDate: "Pick a date",
  dateToday: "Today",
  dateTomorrow: "Tomorrow",
  noScheduled: "Nothing scheduled for later",
  deleteScheduled: (title) => `Delete scheduled task: ${title}`,
};

export const en: NotebookText = {
  sectionLabel: "Tasks",
  addTaskHint: "Add a task, press Enter to save",
  dailyNoteLabel: "Daily note",
  dataNotice: {
    migrationFailed: "Could not move the todos to the new storage; still using the old data. It will try again next start.",
    reimported: "An older version changed the todos, so its data was imported again. The previous data is backed up in the app data folder.",
  },
  dismissNotice: "Dismiss",
  pickDate: "Pick a date",
  dateToday: "Today",
  dateTomorrow: "Tomorrow",
  noScheduled: "Nothing scheduled for later",
  deleteScheduled: (title) => `Delete scheduled task: ${title}`,
};
