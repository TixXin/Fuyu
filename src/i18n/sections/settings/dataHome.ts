export type SettingsDataHomeText = {
  title: string;
  folder: string;
  folderLabel: string;
  hint: string;
  fromEnv: string;
  change: string;
  reveal: string;
  useDefault: string;
  confirm: (path: string) => string;
  moved: (path: string) => string;
  restart: string;
};

export const zhCN: SettingsDataHomeText = {
  title: "数据文件夹",
  folder: "家目录",
  folderLabel: "浮屿数据文件夹的路径",
  hint: "待办、设置、剪贴板历史、插件和每日待办 Markdown 都放在这里。换到一个空文件夹时会把现有数据复制过去；换到已经有浮屿数据的文件夹（比如网盘里同步来的）就直接用它的。旧文件夹不会删除。重启岛屿后生效。同一个文件夹不要在两台电脑上同时用。",
  fromEnv: "由环境变量 FUYU_HOME 指定，在这里改不了。",
  change: "更换",
  reveal: "打开文件夹",
  useDefault: "改回默认",
  confirm: (path) => `把浮屿的数据换到 ${path}？会先复制现有数据（那里已经有浮屿数据时直接用它的），然后重启岛屿。`,
  moved: (path) => `已换到 ${path}，重启岛屿后生效。`,
  restart: "立即重启岛屿",
};

export const en: SettingsDataHomeText = {
  title: "Data folder",
  folder: "Home folder",
  folderLabel: "Path of Fuyu's data folder",
  hint: "Todos, settings, clipboard history, plugins and the daily todo Markdown live here. Moving to an empty folder copies the current data there; a folder that already has Fuyu data (synced from a cloud drive, say) is used as it is. The old folder is not deleted. Takes effect after a restart. Do not use one folder on two computers at once.",
  fromEnv: "Set by the FUYU_HOME environment variable; it cannot be changed here.",
  change: "Change",
  reveal: "Open folder",
  useDefault: "Use the default",
  confirm: (path) => `Move Fuyu's data to ${path}? The current data is copied there first (or the Fuyu data already there is used), then the island restarts.`,
  moved: (path) => `Moved to ${path}. Restart the island to use it.`,
  restart: "Restart the island now",
};
