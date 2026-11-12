/** The first-run guide's own window (windows/onboarding), five acts on a small desktop. */
export type OnboardingText = {
  windowTitle: string;
  /** "Step 2 of 5", for the progress dots. */
  stepOf: (step: number, total: number) => string;
  skip: string;
  back: string;
  next: string;
  close: string;
  /** What the collapsed island says on the small desktop before anything else. */
  islandName: string;
  landing: {
    hellos: string[];
    title: string;
    lead: string;
    tapIsland: string;
    language: string;
  };
  shape: {
    title: string;
    lead: string;
    theme: string;
    accent: string;
    corners: string;
  };
  outfit: {
    title: string;
    lead: string;
    personaQuestion: string;
    personas: Record<"code" | "office" | "study" | "fun", [string, string]>;
    stickers: string;
    stickersHint: string;
    modules: Record<"todo" | "music" | "agents" | "translation" | "shelf" | "mail" | "screenshot" | "clipboard", string>;
  };
  play: {
    title: string;
    lead: string;
    stars: (done: number, total: number) => string;
    allDone: string;
    hover: string;
    click: string;
    expandBy: string;
    expandHover: string;
    expandClick: string;
    drop: string;
    dropFile: string;
    dropKeyboard: string;
    dropHere: string;
    shortcut: (keys: string) => string;
    shortcutHint: string;
    winV: string;
    nowPlaying: string;
    song: string;
    agentWorking: string;
  };
  release: {
    title: string;
    lead: string;
    launchAtStartup: string;
    launchAtStartupHint: string;
    later: string;
    connectAgents: string;
    addMail: string;
    openSettings: string;
    finish: string;
  };
  /** The real island's line for a moment after the guide flies into it. */
  islandWelcome: string;
};

export const zhCN: OnboardingText = {
  windowTitle: "欢迎使用浮屿",
  stepOf: (step, total) => `第 ${step} 步，共 ${total} 步`,
  skip: "跳过",
  back: "上一步",
  next: "下一步",
  close: "关闭",
  islandName: "浮屿",
  landing: {
    hellos: ["你好", "Hello", "こんにちは", "Bonjour", "안녕하세요"],
    title: "一座岛刚刚落在你的屏幕上",
    lead: "它平时安静地停在顶部，有事才变大。花一分钟认识它。",
    tapIsland: "点一下岛开始",
    language: "界面语言",
  },
  shape: {
    title: "把它捏成你喜欢的样子",
    lead: "改动会马上出现在上面的岛上，真正的岛也一样。",
    theme: "深色还是浅色",
    accent: "强调色",
    corners: "圆角",
  },
  outfit: {
    title: "给岛装上功能",
    lead: "先回答一个问题，岛会替你装好一组；再点贴纸增减，或者直接拖到岛上。",
    personaQuestion: "你平时主要用电脑做什么？可以多选。",
    personas: {
      code: ["写代码", "AI Agent、剪贴板、截图"],
      office: ["办公", "待办、邮箱、翻译"],
      study: ["学习", "待办、翻译、音乐"],
      fun: ["娱乐", "音乐、文件中转"],
    },
    stickers: "功能贴纸",
    stickersHint: "亮着的已经装上。点一下装上或卸下，也可以拖到岛上。",
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
    title: "试着用一下",
    lead: "上面的桌面是活的：音乐在放，一个 Agent 在干活。完成下面的小任务。",
    stars: (done, total) => `${done} / ${total}`,
    allDone: "全部完成，你已经会用了。",
    hover: "把鼠标停在岛上，看它展开",
    click: "点一下岛，看它展开",
    expandBy: "展开方式",
    expandHover: "悬停",
    expandClick: "点击",
    drop: "把桌面上的文件拖给岛",
    dropFile: "旅行计划.pdf",
    dropKeyboard: "放进去",
    dropHere: "松开，放进中转",
    shortcut: (keys) => `按一下 ${keys}，剪贴板会弹出来`,
    shortcutHint: "这一步是真的：在任何程序里都能这样打开。",
    winV: "也用 Win+V 打开",
    nowPlaying: "正在播放",
    song: "海边的风",
    agentWorking: "Claude Code · 正在修改 3 个文件",
  },
  release: {
    title: "准备好了",
    lead: "点下面的按钮，这个窗口会飞回屏幕顶部真正的岛里。",
    launchAtStartup: "开机时启动",
    launchAtStartupHint: "登录 Windows 后岛自动出现",
    later: "下面这些要多一步设置，现在或以后都行：",
    connectAgents: "连接 AI 编程工具",
    addMail: "添加邮箱",
    openSettings: "打开设置",
    finish: "开始使用",
  },
  islandWelcome: "浮屿已就绪 · 鼠标停在这里试试",
};

export const en: OnboardingText = {
  windowTitle: "Welcome to Fuyu",
  stepOf: (step, total) => `Step ${step} of ${total}`,
  skip: "Skip",
  back: "Back",
  next: "Next",
  close: "Close",
  islandName: "Fuyu",
  landing: {
    hellos: ["Hello", "你好", "こんにちは", "Bonjour", "안녕하세요"],
    title: "An island just landed on your screen",
    lead: "It rests quietly at the top and grows when something needs you. Take a minute to meet it.",
    tapIsland: "Click the island to begin",
    language: "Language",
  },
  shape: {
    title: "Shape it your way",
    lead: "Changes show on the island above at once, and on the real one too.",
    theme: "Dark or light",
    accent: "Accent",
    corners: "Corners",
  },
  outfit: {
    title: "Give it some features",
    lead: "Answer one question and the island picks a set; then click stickers to add or remove, or drag them onto it.",
    personaQuestion: "What do you mostly use your computer for? Pick any.",
    personas: {
      code: ["Coding", "AI agents, clipboard, screenshots"],
      office: ["Work", "Todos, mail, translation"],
      study: ["Study", "Todos, translation, music"],
      fun: ["Leisure", "Music, file shelf"],
    },
    stickers: "Feature stickers",
    stickersHint: "Lit ones are on. Click to add or remove, or drag one onto the island.",
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
    title: "Give it a try",
    lead: "The desktop above is alive: music is playing and an agent is at work. Do the little tasks below.",
    stars: (done, total) => `${done} / ${total}`,
    allDone: "All done. You know how it works.",
    hover: "Rest the pointer on the island to open it",
    click: "Click the island to open it",
    expandBy: "Opens on",
    expandHover: "Hover",
    expandClick: "Click",
    drop: "Drag the file on the desktop onto the island",
    dropFile: "Trip plan.pdf",
    dropKeyboard: "Put it in",
    dropHere: "Drop to keep it on the shelf",
    shortcut: (keys) => `Press ${keys} and the clipboard pops up`,
    shortcutHint: "This one is real: it works in any app.",
    winV: "Win+V opens it too",
    nowPlaying: "Now playing",
    song: "Sea Breeze",
    agentWorking: "Claude Code · editing 3 files",
  },
  release: {
    title: "You're all set",
    lead: "Press the button and this window flies back into the real island at the top of your screen.",
    launchAtStartup: "Start with Windows",
    launchAtStartupHint: "The island appears after you sign in",
    later: "These take one more step, now or later:",
    connectAgents: "Connect AI coding tools",
    addMail: "Add a mail account",
    openSettings: "Open Settings",
    finish: "Get started",
  },
  islandWelcome: "Fuyu is ready · rest the pointer here",
};
