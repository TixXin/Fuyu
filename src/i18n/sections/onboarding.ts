/** The first-run guide's own window (windows/onboarding). */
export type OnboardingText = {
  windowTitle: string;
  /** "Step 2 of 4", for the progress dots. */
  stepOf: (step: number, total: number) => string;
  skip: string;
  back: string;
  next: string;
  finish: string;
  close: string;
  welcome: {
    title: string;
    lead: string;
    language: string;
    theme: string;
  };
  modules: {
    title: string;
    lead: string;
    todo: [string, string];
    music: [string, string];
    agents: [string, string];
    mail: [string, string];
    shelf: [string, string];
    translation: [string, string];
    clipboard: [string, string];
    screenshot: [string, string];
  };
  habits: {
    title: string;
    lead: string;
    expand: string;
    expandHint: string;
    click: string;
    hover: string;
    autoTuck: string;
    autoTuckHint: string;
    winV: string;
    winVHint: string;
    launchAtStartup: string;
    launchAtStartupHint: string;
  };
  done: {
    title: string;
    lead: string;
    tips: string[];
    connectAgents: string;
    addMail: string;
    openSettings: string;
  };
};

export const zhCN: OnboardingText = {
  windowTitle: "欢迎使用浮屿",
  stepOf: (step, total) => `第 ${step} 步，共 ${total} 步`,
  skip: "跳过引导",
  back: "上一步",
  next: "下一步",
  finish: "开始使用",
  close: "关闭",
  welcome: {
    title: "欢迎使用浮屿",
    lead: "浮屿是停在屏幕顶部的一座小岛：待办、音乐、消息、剪贴板和 AI Agent 状态都收在里面。花一分钟挑一挑，之后随时能在设置里改。",
    language: "界面语言",
    theme: "外观",
  },
  modules: {
    title: "想用哪些功能",
    lead: "关掉的功能不会出现在岛上，也不在后台运行。之后在设置的各功能页里随时打开。",
    todo: ["待办", "今天要做的事、每日笔记和归档"],
    music: ["音乐控制", "控制正在播放的音乐，显示歌词"],
    agents: ["AI Agent 状态", "Claude Code、Codex 在忙、等你还是做完了"],
    mail: ["邮箱", "新邮件提醒，在设置里添加邮箱后生效"],
    shelf: ["文件中转", "把文件先拖到岛上放着，再拖到别处"],
    translation: ["快捷翻译", "选中文字按快捷键翻译"],
    clipboard: ["剪贴板历史", "复制过的文字和图片，随时再贴"],
    screenshot: ["截图", "Ctrl+Shift+数字键截图并复制"],
  },
  habits: {
    title: "怎么用顺手",
    lead: "岛平时收成一条细条，展开后是各个功能的页面。",
    expand: "展开岛",
    expandHint: "点击收起的岛，或者把鼠标停在上面",
    click: "点击",
    hover: "悬停",
    autoTuck: "闲置时收到屏幕边缘",
    autoTuckHint: "一段时间不用就贴边藏起来，鼠标移到顶边再出来",
    winV: "用 Win+V 打开剪贴板历史",
    winVHint: "代替 Windows 自带的剪贴板面板",
    launchAtStartup: "开机时启动",
    launchAtStartupHint: "登录 Windows 后自动出现",
  },
  done: {
    title: "准备好了",
    lead: "下面这些需要多一步设置，现在或以后都可以：",
    tips: [
      "设置在托盘图标的菜单里，也可以从展开的岛上打开",
      "按住岛可以拖到别的位置，右键托盘图标能隐藏它",
    ],
    connectAgents: "连接 AI 编程工具",
    addMail: "添加邮箱",
    openSettings: "打开设置",
  },
};

export const en: OnboardingText = {
  windowTitle: "Welcome to Fuyu",
  stepOf: (step, total) => `Step ${step} of ${total}`,
  skip: "Skip",
  back: "Back",
  next: "Next",
  finish: "Get started",
  close: "Close",
  welcome: {
    title: "Welcome to Fuyu",
    lead: "Fuyu is a small island at the top of your screen that holds your todos, music, messages, clipboard and AI agent status. Take a minute to pick what you want; you can change all of it in Settings later.",
    language: "Language",
    theme: "Appearance",
  },
  modules: {
    title: "Pick your modules",
    lead: "Modules you turn off leave the island and stop running in the background. Turn them on any time on their settings pages.",
    todo: ["Todos", "What to do today, daily notes and an archive"],
    music: ["Music controls", "Control what is playing and show lyrics"],
    agents: ["AI agent status", "Whether Claude Code, Codex and others are working, waiting on you or done"],
    mail: ["Mail", "New mail alerts and previews, once you add an account in Settings"],
    shelf: ["File shelf", "Drop files on the island and drag them out somewhere else"],
    translation: ["Quick translation", "Translate selected text with a shortcut"],
    clipboard: ["Clipboard history", "Text and images you copied, ready to paste again"],
    screenshot: ["Screenshots", "Ctrl+Shift+digit to capture and copy"],
  },
  habits: {
    title: "Make it yours",
    lead: "The island rests as a slim bar and opens into a page for each module.",
    expand: "Open the island",
    expandHint: "Click the bar, or rest the pointer on it",
    click: "Click",
    hover: "Hover",
    autoTuck: "Tuck to the edge when idle",
    autoTuckHint: "Hides at the screen edge after a while; move the pointer to the top to bring it back",
    winV: "Open clipboard history with Win+V",
    winVHint: "Instead of the Windows clipboard panel",
    launchAtStartup: "Start with Windows",
    launchAtStartupHint: "Appears after you sign in",
  },
  done: {
    title: "You're all set",
    lead: "These take one more step, now or later:",
    tips: [
      "Settings are in the tray icon's menu, and on the open island",
      "Drag the island to move it; right-click the tray icon to hide it",
    ],
    connectAgents: "Connect AI coding tools",
    addMail: "Add a mail account",
    openSettings: "Open Settings",
  },
};
