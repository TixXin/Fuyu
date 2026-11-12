export type SettingsTodoText = {
  title: string;
  carryOverIncomplete: string;
  enableReorder: string;
  rotateTodos: string;
  rotationSeconds: string;
  projects: string;
  projectsHint: string;
  projectsEmpty: string;
  newProject: string;
  projectName: (name: string) => string;
  moveUp: (name: string) => string;
  moveDown: (name: string) => string;
  removeProject: (name: string) => string;
};

export const zhCN: SettingsTodoText = {
  title: "任务",
  carryOverIncomplete: "自动将未完成任务写入下一天",
  enableReorder: "允许拖动调整任务顺序",
  rotateTodos: "多任务流动",
  rotationSeconds: "每个任务停留时间（秒）",
  projects: "项目",
  projectsHint: "待办页的筛选条和新建待办时可选这些项目，没选项目的待办归「临时」。改名会连同计划中和历史归档里的待办一起改，已保存的每日 Markdown 会重写；删除项目后，它今天和计划中的待办归到「临时」，历史归档不变。",
  projectsEmpty: "还没有项目。在下面输入名字，或在待办页点筛选条上的 +。",
  newProject: "新项目名，回车添加",
  projectName: (name) => `项目「${name}」的名字`,
  moveUp: (name) => `上移「${name}」`,
  moveDown: (name) => `下移「${name}」`,
  removeProject: (name) => `删除项目「${name}」`,
};

export const en: SettingsTodoText = {
  title: "Tasks",
  carryOverIncomplete: "Carry unfinished tasks to next day",
  enableReorder: "Drag to reorder tasks",
  rotateTodos: "Rotate through pending tasks",
  rotationSeconds: "Time per task (seconds)",
  projects: "Projects",
  projectsHint: "The todo page's filter and new tasks offer these projects; a task without one is in the Inbox. Renaming one renames it in planned tasks and the archive too, and saved daily Markdown is written again; removing one moves its tasks of today and later to the Inbox and leaves the archive as it was.",
  projectsEmpty: "No projects yet. Type a name below, or press + on the todo page's filter.",
  newProject: "New project name, Enter to add",
  projectName: (name) => `Name of ${name}`,
  moveUp: (name) => `Move ${name} up`,
  moveDown: (name) => `Move ${name} down`,
  removeProject: (name) => `Remove ${name}`,
};
