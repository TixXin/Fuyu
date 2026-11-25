import { en as pushEn, zhCN as pushZhCN, type OnboardingPushText } from "./onboarding-push.ts";

export type OnboardingText = {
  windowTitle: string;
  stepOf: (step: number, total: number) => string;
  stepCounter: (step: number, total: number) => string;
  stepJump: (label: string) => string;
  exit: string;
  skipStep: string;
  back: string;
  backToSummary: string;
  next: string;
  startTour: string;
  doneSetup: string;
  close: string;
  escHint: string;
  islandName: string;
  noIsland: string;
  noIslandMac: string;
  stages: Record<"hello" | "shape" | "outfit" | "permissions" | "play" | "release", string>;
  setupStages: Record<"agentCards" | "agentConnect" | "push", string>;
  hello: {
    title: string;
    lead: string;
    language: string;
    previewLabel: string;
    previewItems: [string, string, string];
  };
  shape: {
    title: string;
    lead: string;
    theme: string;
    look: string;
    solid: string;
    glassHint: string;
  };
  outfit: {
    title: string;
    lead: string;
    personaQuestion: string;
    personas: Record<"code" | "office" | "study" | "fun", string>;
    list: (names: string[]) => string;
    takenOff: (names: string) => string;
    selectedCount: (on: number, total: number) => string;
    stickers: string;
    stickersHint: string;
    modules: Record<"todo" | "music" | "agents" | "translation" | "shelf" | "mail" | "screenshot" | "clipboard", string>;
  };
  play: {
    title: string;
    lead: (song: boolean, agent: boolean) => string;
    stars: (done: number, total: number) => string;
    allDone: string;
    hover: string;
    click: string;
    expandBy: string;
    expandHover: string;
    expandClick: string;
    drop: string;
    dropMac: string;
    dropHint: string;
    shortcut: (keys: string) => string;
    shortcutHint: string;
    winV: string;
  };
  permissions: {
    title: string;
    lead: string;
    allGranted: string;
    later: string;
  };
  push: OnboardingPushText;
  agentCards: {
    title: string;
    lead: string;
    recommended: (label: string) => string;
    recommendedBadge: string;
  };
  agentConnect: {
    title: string;
    lead: string;
    remote: string;
    agents: string;
    marker: string;
  };
  bundle: {
    title: string;
    lead: string;
    contains: string;
    open: string;
    later: string;
  };
  release: {
    title: string;
    lead: string;
    launchAtStartup: string;
    launchAtStartupMac: string;
    launchAtStartupHint: string;
    launchAtStartupHintMac: string;
    extensionsTitle: string;
    extensionsHint: string;
    agentSetupTitle: string;
    agentSetupDesc: string;
    agentSetupDone: string;
    agentSetupAction: string;
    agentSetupActionAgain: string;
    bundleTitle: string;
    bundleAction: string;
    mailTitle: string;
    mailDesc: string;
    mailAction: string;
    openSettings: string;
    findLater: string;
    findLaterMac: string;
    finish: string;
  };
  greeting: Record<"hello" | "ready", { title: string; body: string }>;
  demo: {
    song: string;
    artist: string;
    source: string;
    agentTitle: string;
    agentPrompt: string;
  };
};

export const zhCN: OnboardingText = {
  windowTitle: "欢迎使用浮屿",
  stepOf: (step, total) => `第 ${step} 步，共 ${total} 步`,
  stepCounter: (step, total) => `${step} / ${total}`,
  stepJump: (label) => `回到「${label}」`,
  exit: "稍后再说",
  skipStep: "跳过此步",
  back: "上一步",
  backToSummary: "返回收尾",
  next: "下一步",
  startTour: "开始认识",
  doneSetup: "完成配置",
  close: "关闭引导",
  escHint: "按 Esc 随时退出",
  islandName: "浮屿",
  noIsland: "岛现在藏起来了。点托盘图标让它出来，引导会跟着它。",
  noIslandMac: "岛现在藏起来了。点菜单栏里的浮屿图标让它出来，引导会跟着它。",
  stages: {
    hello: "认识浮屿",
    shape: "外观风格",
    outfit: "功能搭配",
    permissions: "系统权限",
    play: "上手体验",
    release: "准备就绪",
  },
  setupStages: {
    agentCards: "会话样式",
    agentConnect: "连接代理",
    push: "手机推送",
  },
  hello: {
    title: "你好，这就是浮屿",
    lead: "亮着的就是它：平时安静地停在屏幕顶部，有事才变大。一分钟带你定好风格并上手试试。",
    language: "界面语言",
    previewLabel: "接下来会一起完成",
    previewItems: ["挑外观风格", "留常用功能", "真岛试一下"],
  },
  shape: {
    title: "把它捏成你喜欢的样子",
    lead: "改动会立刻出现在顶部真岛上。圆角、开合动画等细节以后随时可以在设置里微调。",
    theme: "深色还是浅色",
    look: "质感",
    solid: "纯色",
    glassHint: "透出桌面壁纸的毛玻璃。颜色、流动和模糊在「设置 → 外观 → 样式」里调。系统关掉「透明效果」或读不到壁纸（目前 Mac 上）时显示为纯色玻璃。",
  },
  outfit: {
    title: "留下你用得上的功能",
    lead: "先选一个最像你日常电脑用途的组合，再用下面的功能贴纸自由增减；顶部真岛的图标会跟着变化。",
    personaQuestion: "你平时主要用电脑做什么？（可多选，再点一次撤回）",
    personas: {
      code: "写代码",
      office: "办公",
      study: "学习",
      fun: "娱乐",
    },
    list: (names) => names.join("、"),
    takenOff: (names) => `已卸下：${names}。点贴纸就能装回，以后在设置里也行。`,
    selectedCount: (on, total) => `已开启 ${on} / ${total}`,
    stickers: "功能贴纸",
    stickersHint: "点击贴纸随时装上或卸下",
    modules: {
      todo: "待办",
      music: "音乐",
      agents: "AI Agent",
      translation: "翻译",
      shelf: "文件中转",
      mail: "邮箱",
      screenshot: "截图",
      clipboard: "剪贴板",
    },
  },
  play: {
    title: "在真岛上试一下",
    lead: (song, agent) =>
      song && agent ? "岛上正放着一首演示歌曲，还有一个演示 Agent 在干活。动手完成下面的小任务，每完成一个亮一颗星。"
        : song ? "岛上正放着一首演示歌曲。动手完成下面的小任务，每完成一个亮一颗星。"
          : agent ? "岛上有一个演示 Agent 在干活。动手完成下面的小任务，每完成一个亮一颗星。"
            : "动手完成下面的小任务，每完成一个亮一颗星。",
    stars: (done, total) => `${done} / ${total}`,
    allDone: "全部完成，你已经上手了。",
    hover: "把鼠标停在岛上，让它展开",
    click: "点一下岛，让它展开",
    expandBy: "展开方式",
    expandHover: "悬停",
    expandClick: "点击",
    drop: "从桌面或资源管理器拖一个文件到岛上",
    dropMac: "从桌面或访达拖一个文件到岛上",
    dropHint: "文件只记路径，不会被移动。",
    shortcut: (keys) => `按一下 ${keys}，剪贴板会弹出来`,
    shortcutHint: "在任何程序里都能这样打开。",
    winV: "也用 Win+V 打开",
  },
  permissions: {
    title: "先开几个 macOS 权限",
    lead: "你选的功能要用到下面这些系统权限，开了以后下一步练习和日常快捷键才能直接生效。",
    allGranted: "权限都已允许，你选的功能都可以直接用。",
    later: "现在不开也可以点「跳过此步」，以后在「设置 → 通用 → 系统权限」里随时能补开。",
  },
  push: pushZhCN,
  agentCards: {
    title: "选一种 Agent 会话布局",
    lead: "挑一个看着顺眼的布局，标了推荐的是默认搭配，以后在「设置 → AI Agent → 会话列表」里随时可换。",
    recommended: (label) => `${label}（推荐）`,
    recommendedBadge: "推荐",
  },
  agentConnect: {
    title: "连上你的 AI 代理",
    lead: "按顺序三步：有 SSH 远程电脑就先加上；打开你在用的 AI 代理并安装状态钩子；再打开回复状态标记。以后在「设置 → AI Agent」里都能改。",
    remote: "1. SSH 远程电脑（可跳过）",
    agents: "2. 选 AI 代理，装上钩子",
    marker: "3. 回复状态标记（推荐打开）",
  },
  bundle: {
    title: "推荐插件套装",
    lead: "几个搭配好一起用的插件，在插件市场里确认一次就能装好。",
    contains: "包含插件",
    open: "看看这个套装",
    later: "点击后会结束引导并打开插件市场，确认后才安装。",
  },
  release: {
    title: "浮屿已就绪",
    lead: "点「开始使用」后演示内容会收起，真正的岛会安静留在屏幕顶部。",
    launchAtStartup: "开机时启动",
    launchAtStartupMac: "登录 Mac 时启动",
    launchAtStartupHint: "登录 Windows 后岛自动出现",
    launchAtStartupHintMac: "登录 Mac 后岛自动出现",
    extensionsTitle: "按需进阶配置",
    extensionsHint: "以下为可选项，随时可以在设置里再弄。",
    agentSetupTitle: "配置 AI Agent 与手机推送",
    agentSetupDesc: "选会话布局、装状态钩子、可选接入飞书 / Telegram 推送",
    agentSetupDone: "已配置",
    agentSetupAction: "去配置",
    agentSetupActionAgain: "再次查看",
    bundleTitle: "推荐插件套装",
    bundleAction: "去市场看看",
    mailTitle: "添加邮箱账号",
    mailDesc: "在岛上接收新邮件提醒与快速预览",
    mailAction: "去设置",
    openSettings: "打开全部设置",
    findLater: "以后想改什么：右键托盘里的浮屿图标，选「设置」。",
    findLaterMac: "以后想改什么：点菜单栏里的浮屿图标，选「设置」。",
    finish: "开始使用",
  },
  greeting: {
    hello: { title: "你好啊，我在这儿 👋", body: "我是浮屿，就住在屏幕顶部。跟着引导认识一下我吧。" },
    ready: { title: "浮屿已就绪", body: "有事我会在这里叫你。鼠标停在岛上就能打开我。" },
  },
  demo: {
    song: "海边的风",
    artist: "浮屿演示",
    source: "浮屿",
    agentTitle: "新手引导演示",
    agentPrompt: "给待办加上按项目分组",
  },
};

export const en: OnboardingText = {
  windowTitle: "Welcome to Fuyu",
  stepOf: (step, total) => `Step ${step} of ${total}`,
  stepCounter: (step, total) => `${step} / ${total}`,
  stepJump: (label) => `Go back to ${label}`,
  exit: "Not now",
  skipStep: "Skip step",
  back: "Back",
  backToSummary: "Back to finish",
  next: "Next",
  startTour: "Let's start",
  doneSetup: "Done",
  close: "Close the guide",
  escHint: "Press Esc to leave at any time",
  islandName: "Fuyu",
  noIsland: "The island is hidden. Click the tray icon to bring it back, and the guide will follow it.",
  noIslandMac: "The island is hidden. Click the Fuyu icon in the menu bar to bring it back, and the guide will follow it.",
  stages: {
    hello: "Welcome",
    shape: "Look",
    outfit: "Features",
    permissions: "Permissions",
    play: "Try it",
    release: "Ready",
  },
  setupStages: {
    agentCards: "Layout",
    agentConnect: "Connect",
    push: "Phone push",
  },
  hello: {
    title: "Hi, this is Fuyu",
    lead: "That's it, lit up at the top of your screen: quiet while you work, expanding when something needs you. Take a minute to make it yours.",
    language: "Language",
    previewLabel: "What we'll do next",
    previewItems: ["Pick a look", "Choose features", "Try the real island"],
  },
  shape: {
    title: "Shape it your way",
    lead: "Changes appear on the real island immediately. Corners, motion and finer details are always in Settings.",
    theme: "Dark or light",
    look: "Surface",
    solid: "Solid",
    glassHint: "Frosted glass showing your desktop wallpaper. Colors, flow and blur are in Settings → Appearance → Style. With Transparency effects off, or no wallpaper to read (on Mac for now), the glass stays solid.",
  },
  outfit: {
    title: "Keep the features you'll use",
    lead: "Start with a preset that matches how you use this computer, then toggle individual stickers while watching the island update live.",
    personaQuestion: "What do you mostly use your computer for? (Pick any; click again to undo)",
    personas: {
      code: "Coding",
      office: "Work",
      study: "Study",
      fun: "Leisure",
    },
    list: (names) => names.join(", "),
    takenOff: (names) => `Taken off: ${names}. Click a sticker to put one back, or do it in Settings later.`,
    selectedCount: (on, total) => `${on} / ${total} on`,
    stickers: "Feature stickers",
    stickersHint: "Click any sticker to turn it on or off",
    modules: {
      todo: "Todos",
      music: "Music",
      agents: "AI agents",
      translation: "Translate",
      shelf: "File shelf",
      mail: "Mail",
      screenshot: "Screenshots",
      clipboard: "Clipboard",
    },
  },
  play: {
    title: "Try it on the real island",
    lead: (song, agent) =>
      song && agent ? "The island is playing a demo song and running a demo agent. Try the quick tasks below to light each star."
        : song ? "The island is playing a demo song. Try the quick tasks below to light each star."
          : agent ? "A demo agent is at work on the island. Try the quick tasks below to light each star."
            : "Try the quick tasks below. Each one lights a star.",
    stars: (done, total) => `${done} / ${total}`,
    allDone: "All done — you've got the hang of it.",
    hover: "Rest the pointer on the island to open it",
    click: "Click the island to open it",
    expandBy: "Opens on",
    expandHover: "Hover",
    expandClick: "Click",
    drop: "Drag a file from the desktop or Explorer onto the island",
    dropMac: "Drag a file from the desktop or Finder onto the island",
    dropHint: "Only its path is kept; the file stays where it is.",
    shortcut: (keys) => `Press ${keys} and the clipboard pops up`,
    shortcutHint: "It works in any app.",
    winV: "Win+V opens it too",
  },
  permissions: {
    title: "Allow macOS permissions first",
    lead: "The features you chose rely on these macOS permissions so shortcuts and capture work right away in the next step.",
    allGranted: "All set — every feature you picked is ready to work.",
    later: "You can also click Skip step now and enable these later in Settings → General → System permissions.",
  },
  push: pushEn,
  agentCards: {
    title: "Pick an agent session layout",
    lead: "Choose how sessions appear on the Agent tab. Recommended options are selected by default and stay editable in Settings → AI Agent.",
    recommended: (label) => `${label} (recommended)`,
    recommendedBadge: "Recommended",
  },
  agentConnect: {
    title: "Connect your AI agents",
    lead: "Three quick parts: add SSH remote computers if needed, enable your AI agents and install status hooks, then turn on the reply status marker.",
    remote: "1. SSH remote computers (optional)",
    agents: "2. Pick your agents and give them hooks",
    marker: "3. Reply status marker (recommended)",
  },
  bundle: {
    title: "Recommended plugin bundle",
    lead: "A curated group of plugins that work well together, installed after one confirmation in the market.",
    contains: "Includes",
    open: "See this bundle",
    later: "Clicking opens the plugin market and ends the guide; nothing installs until you confirm there.",
  },
  release: {
    title: "You're all set",
    lead: "Click Get started to clear the demo content and keep Fuyu ready at the top of your screen.",
    launchAtStartup: "Start with Windows",
    launchAtStartupMac: "Open at Mac login",
    launchAtStartupHint: "The island appears after you sign in",
    launchAtStartupHintMac: "The island appears after you log in to your Mac",
    extensionsTitle: "Optional setup",
    extensionsHint: "You can configure these now or come back to Settings anytime.",
    agentSetupTitle: "Set up AI agents & phone push",
    agentSetupDesc: "Choose session layout, install hooks, and optionally connect Feishu / Telegram push",
    agentSetupDone: "Configured",
    agentSetupAction: "Set up",
    agentSetupActionAgain: "Review",
    bundleTitle: "Recommended bundle",
    bundleAction: "Open in market",
    mailTitle: "Add a mail account",
    mailDesc: "Get incoming mail alerts and previews on the island",
    mailAction: "Open settings",
    openSettings: "Open all settings",
    findLater: "To change anything later, right-click the Fuyu icon in the tray and pick Settings.",
    findLaterMac: "To change anything later, click the Fuyu icon in the menu bar and pick Settings.",
    finish: "Get started",
  },
  greeting: {
    hello: { title: "Hi there, I'm up here 👋", body: "I'm Fuyu and I live at the top of your screen. Follow the guide to get to know me." },
    ready: { title: "Fuyu is ready", body: "I'll call you up here when something needs you. Rest the pointer on me to open me." },
  },
  demo: {
    song: "Sea Breeze",
    artist: "Fuyu demo",
    source: "Fuyu",
    agentTitle: "Welcome guide demo",
    agentPrompt: "Group todos by project",
  },
};
