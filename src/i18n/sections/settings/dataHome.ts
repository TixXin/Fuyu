export type SettingsDataHomeText = {
  title: string;
  groupTitle: string;
  folder: string;
  folderLabel: string;
  hint: string;
  fromEnv: string;
  portable: string;
  portableBlocked: (path: string) => string;
  change: string;
  confirmAction: string;
  reveal: string;
  revealMac: string;
  useDefault: string;
  confirm: (path: string) => string;
  moved: (path: string) => string;
  restart: string;
};

export const zhCN: SettingsDataHomeText = {
  title: "数据文件夹",
  groupTitle: "数据",
  folder: "家目录",
  folderLabel: "浮屿数据文件夹的路径",
  hint: "待办、设置、剪贴板历史、插件和每日待办 Markdown 都放在这里。换到一个空文件夹时会把现有数据复制过去；换到已经有浮屿数据的文件夹（比如网盘里同步来的）就直接用它的。旧文件夹不会删除。重启岛屿后生效。同一个文件夹不要在两台电脑上同时用。",
  fromEnv: "由环境变量 FUYU_HOME 指定，在这里改不了。",
  portable: "便携版：数据放在程序旁边的 data 文件夹，在这里改不了；要换位置就把整个程序文件夹搬走。",
  portableBlocked: (path) => `程序旁边有便携标记，但 ${path} 写不进去（比如放在了 Program Files 里），这次先用下面的文件夹。把程序文件夹挪到可写的位置再重启，就会进入便携模式。`,
  change: "更换",
  confirmAction: "确认更换",
  reveal: "打开文件夹",
  revealMac: "在访达中打开",
  useDefault: "改回默认",
  confirm: (path) => `把浮屿的数据换到 ${path}？会先复制现有数据（那里已经有浮屿数据时直接用它的），然后重启岛屿。`,
  moved: (path) => `已换到 ${path}，重启岛屿后生效。`,
  restart: "立即重启岛屿",
};

export const en: SettingsDataHomeText = {
  title: "Data folder",
  groupTitle: "Data",
  folder: "Home folder",
  folderLabel: "Path of Fuyu's data folder",
  hint: "Todos, settings, clipboard history, plugins and the daily todo Markdown live here. Moving to an empty folder copies the current data there; a folder that already has Fuyu data (synced from a cloud drive, say) is used as it is. The old folder is not deleted. Takes effect after a restart. Do not use one folder on two computers at once.",
  fromEnv: "Set by the FUYU_HOME environment variable; it cannot be changed here.",
  portable: "Portable copy: the data lives in the data folder next to the program and cannot be changed here. Move the whole program folder to move it.",
  portableBlocked: (path) => `The program has a portable marker, but ${path} is not writable (inside Program Files, say), so the folder below is used for now. Move the program folder somewhere writable and restart to run it portable.`,
  change: "Change",
  confirmAction: "Confirm move",
  reveal: "Open folder",
  revealMac: "Open in Finder",
  useDefault: "Use the default",
  confirm: (path) => `Move Fuyu's data to ${path}? The current data is copied there first (or the Fuyu data already there is used), then the island restarts.`,
  moved: (path) => `Moved to ${path}. Restart the island to use it.`,
  restart: "Restart the island now",
};
