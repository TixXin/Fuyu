export type SettingsDevBuildText = {
  mark: string;
  launchAtStartupOff: string;
  updateOff: string;
  priorityLabel: string;
  releaseFirst: string;
  devFirst: string;
  status: {
    alone: string;
    yielding: string;
    releaseYields: string;
    both: string;
  };
};

export const zhCN: SettingsDevBuildText = {
  mark: "DEV",
  launchAtStartupOff: "这是开发版，不改开机自启。请在安装的正式版里设置。",
  updateOff: "这是开发版，不检查也不安装更新。新版本请在安装的正式版里更新。",
  priorityLabel: "快捷键和提醒归谁",
  releaseFirst: "正式版优先",
  devFirst: "开发版优先",
  status: {
    alone: "正式版没在运行",
    yielding: "开发版已让出快捷键和提醒",
    releaseYields: "正式版已让出，审批也到这里",
    both: "正式版没让（版本太旧），可能互相抢",
  },
};

export const en: SettingsDevBuildText = {
  mark: "DEV",
  launchAtStartupOff: "This is a development build, so it doesn't change launch at startup. Set it in the installed app.",
  updateOff: "This is a development build, so it doesn't check for or install updates. Update the installed app instead.",
  priorityLabel: "Who gets the shortcuts and alerts",
  releaseFirst: "Installed first",
  devFirst: "Dev first",
  status: {
    alone: "The installed app isn't running",
    yielding: "This build gave up shortcuts and alerts",
    releaseYields: "The installed app stepped back; approvals come here",
    both: "The installed app is too old to step back",
  },
};
