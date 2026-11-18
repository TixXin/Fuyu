export type SettingsBackupText = {
  title: string;
  save: string;
  restore: string;
  saveAction: string;
  restoreAction: string;
  hint: string;
  hintMac: string;
  saved: (path: string) => string;
  reveal: string;
  revealMac: string;
  confirmRestore: string;
  confirmRestoreAction: string;
  restored: (count: number) => string;
  restart: string;
  problems: { notJson: string; notBackup: string; newerVersion: string; empty: string };
  updates: {
    title: string;
    hint: string;
    none: string;
    item: (from: string, to: string) => string;
    meta: (time: string, size: string, files: number) => string;
    restoreAction: string;
    confirmRestore: (from: string, time: string) => string;
    restoring: string;
    pending: string;
    broken: string;
    brokenFiles: (files: string) => string;
    installAnyway: string;
    installAnywayHint: string;
    installAnywayAction: string;
  };
};

export const zhCN: SettingsBackupText = {
  title: "备份与恢复",
  save: "导出设置",
  restore: "从文件恢复",
  saveAction: "导出…",
  restoreAction: "选择文件…",
  hint: "把外观、展开收起、快捷键、翻译、消息、AI Agent（提醒、审批、手机推送、声音）、歌词偏移、插件页面、更新等设置导出成一个文件，重装系统或换电脑后再导入。不包含待办、窗口位置和保存在 Windows 凭据管理器里的密钥与授权码。",
  hintMac: "把外观、展开收起、快捷键、翻译、消息、AI Agent（提醒、审批、手机推送、声音）、歌词偏移、插件页面、更新等设置导出成一个文件，重装系统或换电脑后再导入。不包含待办、窗口位置和保存在钥匙串里的密钥与授权码。",
  saved: (path) => `已导出到 ${path}`,
  reveal: "在文件夹中显示",
  revealMac: "在访达中显示",
  confirmRestore: "用这个文件里的设置替换当前设置？当前设置不会另外保存，需要的话请先导出一份。",
  confirmRestoreAction: "确认恢复",
  restored: (count) => `已恢复 ${count} 项设置。大部分立即生效，个别设置重启岛屿后生效。`,
  restart: "立即重启岛屿",
  problems: {
    notJson: "这个文件不是有效的 JSON，无法恢复。",
    notBackup: "这不是浮屿导出的设置文件。",
    newerVersion: "这个设置文件来自更新的版本，请先把岛屿更新到最新版。",
    empty: "这个文件里没有可以恢复的设置。",
  },
  updates: {
    title: "升级前的备份",
    hint: "每次安装更新前，岛屿自动把设置、待办、剪贴板记录、插件数据等备份到数据文件夹的 backups，核对无误才安装，只留最近 3 份。不含截图、缓存和凭据里的密码。恢复会把数据换回备份时的样子并重启岛屿，不会改回旧版本的程序。",
    none: "还没有备份。下次安装更新前会自动备份。",
    item: (from, to) => `${from} → ${to}`,
    meta: (time, size, files) => `${time} · ${size} · ${files} 个文件`,
    restoreAction: "恢复…",
    confirmRestore: (from, time) => `把数据恢复到 ${time}（${from} 升级前）的样子？之后的设置和待办改动会丢失，岛屿会立即重启。`,
    restoring: "正在恢复…",
    pending: "已恢复设置，重启岛屿后放回其余数据。",
    broken: "升级后有数据没读出来，可以从升级前的备份恢复。",
    brokenFiles: (files) => `读不出来的文件已另存为：${files}`,
    installAnyway: "不备份，仍然安装",
    installAnywayHint: "备份失败时才显示。出问题就没法从备份恢复。",
    installAnywayAction: "仍然安装",
  },
};

export const en: SettingsBackupText = {
  title: "Backup and restore",
  save: "Export settings",
  restore: "Restore from file",
  saveAction: "Export…",
  restoreAction: "Choose file…",
  hint: "Export appearance, expand and tuck, shortcuts, translation, messages, AI Agent (alerts, approvals, phone push, sounds), lyrics offsets, plugin pages, updates and other settings to a file, and import it after reinstalling or on another computer. Todos, window positions, and keys and codes kept in Windows Credential Manager are not included.",
  hintMac: "Export appearance, expand and tuck, shortcuts, translation, messages, AI Agent (alerts, approvals, phone push, sounds), lyrics offsets, plugin pages, updates and other settings to a file, and import it after reinstalling or on another computer. Todos, window positions, and keys and codes kept in the keychain are not included.",
  saved: (path) => `Exported to ${path}`,
  reveal: "Show in folder",
  revealMac: "Show in Finder",
  confirmRestore: "Replace the current settings with the ones in this file? The current settings are not saved separately; export them first if you need them.",
  confirmRestoreAction: "Confirm restore",
  restored: (count) => `Restored ${count} settings. Most apply now; a few apply after the island restarts.`,
  restart: "Restart the island",
  problems: {
    notJson: "This file is not valid JSON and cannot be restored.",
    notBackup: "This is not a settings file exported by Fuyu.",
    newerVersion: "This settings file comes from a newer version. Update the island first.",
    empty: "This file has no settings to restore.",
  },
  updates: {
    title: "Backups before updates",
    hint: "Before each update is installed, the island backs up your settings, todos, clipboard history, plugin data and more to the backups folder in its data folder, checks the copy, and only then installs. The latest 3 are kept. Screenshots, caches and passwords in your credentials are not included. Restoring puts your data back as it was and restarts the island; it doesn't bring back the old version of the app.",
    none: "No backups yet. One is made automatically before the next update is installed.",
    item: (from, to) => `${from} → ${to}`,
    meta: (time, size, files) => `${time} · ${size} · ${files} files`,
    restoreAction: "Restore…",
    confirmRestore: (from, time) => `Put your data back as it was at ${time} (before updating from ${from})? Settings and todos changed since then will be lost, and the island restarts right away.`,
    restoring: "Restoring…",
    pending: "Settings restored; the rest of the data goes back when the island restarts.",
    broken: "Some data could not be read after the update. You can restore a backup made before it.",
    brokenFiles: (files) => `The unreadable files were set aside as: ${files}`,
    installAnyway: "Install without a backup",
    installAnywayHint: "Shown only when the backup failed. If something goes wrong, there is no backup to restore.",
    installAnywayAction: "Install anyway",
  },
};
