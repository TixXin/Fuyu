/** The first-run guide (windows/onboarding): an overlay that lights up the real island, in five acts. */
export type OnboardingText = {
  windowTitle: string;
  /** "Step 2 of 5", for the progress dots. */
  stepOf: (step: number, total: number) => string;
  skip: string;
  back: string;
  next: string;
  close: string;
  /** Under the card: Esc leaves the guide. */
  escHint: string;
  /** The island's own name, for its greetings. */
  islandName: string;
  /** Shown while the island is hidden in the tray, so there is nothing to light up. */
  noIsland: string;
  hello: {
    title: string;
    lead: string;
    language: string;
  };
  shape: {
    title: string;
    lead: string;
    theme: string;
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
    dropHint: string;
    shortcut: (keys: string) => string;
    shortcutHint: string;
    winV: string;
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
  /** What the island says in its message panel as the guide opens and as it ends. */
  greeting: Record<"hello" | "ready", { title: string; body: string }>;
  /** The song and agent session the island plays while the guide runs. */
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
  skip: "跳过",
  back: "上一步",
  next: "下一步",
  close: "关闭引导",
  escHint: "按 Esc 随时退出",
  islandName: "浮屿",
  noIsland: "岛现在藏起来了。点托盘图标让它出来，引导会跟着它。",
  hello: {
    title: "你好，这就是浮屿",
    lead: "亮着的就是它：平时安静地停在屏幕顶部，有事才变大。花一分钟认识一下。",
    language: "界面语言",
  },
  shape: {
    title: "把它捏成你喜欢的样子",
    lead: "改动马上出现在真正的岛上。",
    theme: "深色还是浅色",
    corners: "圆角",
  },
  outfit: {
    title: "给岛装上功能",
    lead: "回答一个问题，岛会替你装好一组；再点贴纸增减。看看岛上的图标怎么变。",
    personaQuestion: "你平时主要用电脑做什么？可以多选。",
    personas: {
      code: ["写代码", "AI Agent、剪贴板、截图"],
      office: ["办公", "待办、邮箱、翻译"],
      study: ["学习", "待办、翻译、音乐"],
      fun: ["娱乐", "音乐、文件中转"],
    },
    stickers: "功能贴纸",
    stickersHint: "亮着的已经装上，点一下装上或卸下。",
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
    lead: "岛上正放着一首演示歌曲，还有一个演示 Agent 在干活。完成下面的小任务。",
    stars: (done, total) => `${done} / ${total}`,
    allDone: "全部完成，你已经会用了。",
    hover: "把鼠标停在岛上，让它展开",
    click: "点一下岛，让它展开",
    expandBy: "展开方式",
    expandHover: "悬停",
    expandClick: "点击",
    drop: "从桌面或资源管理器拖一个文件到岛上",
    dropHint: "文件只记路径，不会被移动。",
    shortcut: (keys) => `按一下 ${keys}，剪贴板会弹出来`,
    shortcutHint: "在任何程序里都能这样打开。",
    winV: "也用 Win+V 打开",
  },
  release: {
    title: "准备好了",
    lead: "演示的歌和 Agent 会在引导结束时消失，岛会留在原地。",
    launchAtStartup: "开机时启动",
    launchAtStartupHint: "登录 Windows 后岛自动出现",
    later: "下面这些要多一步设置，现在或以后都行：",
    connectAgents: "连接 AI 编程工具",
    addMail: "添加邮箱",
    openSettings: "打开设置",
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
  skip: "Skip",
  back: "Back",
  next: "Next",
  close: "Close the guide",
  escHint: "Press Esc to leave at any time",
  islandName: "Fuyu",
  noIsland: "The island is hidden. Click the tray icon to bring it back, and the guide will follow it.",
  hello: {
    title: "Hi, this is Fuyu",
    lead: "That's it, lit up: it rests quietly at the top of the screen and grows when something needs you. Take a minute to meet it.",
    language: "Language",
  },
  shape: {
    title: "Shape it your way",
    lead: "Changes show on the real island at once.",
    theme: "Dark or light",
    corners: "Corners",
  },
  outfit: {
    title: "Give it some features",
    lead: "Answer one question and the island picks a set; then click stickers to add or remove. Watch its icons change.",
    personaQuestion: "What do you mostly use your computer for? Pick any.",
    personas: {
      code: ["Coding", "AI agents, clipboard, screenshots"],
      office: ["Work", "Todos, mail, translation"],
      study: ["Study", "Todos, translation, music"],
      fun: ["Leisure", "Music, file shelf"],
    },
    stickers: "Feature stickers",
    stickersHint: "Lit ones are on. Click to add or remove.",
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
    lead: "The island is playing a demo song and a demo agent is at work. Do the little tasks below.",
    stars: (done, total) => `${done} / ${total}`,
    allDone: "All done. You know how it works.",
    hover: "Rest the pointer on the island to open it",
    click: "Click the island to open it",
    expandBy: "Opens on",
    expandHover: "Hover",
    expandClick: "Click",
    drop: "Drag a file from the desktop or Explorer onto the island",
    dropHint: "Only its path is kept; the file stays where it is.",
    shortcut: (keys) => `Press ${keys} and the clipboard pops up`,
    shortcutHint: "It works in any app.",
    winV: "Win+V opens it too",
  },
  release: {
    title: "You're all set",
    lead: "The demo song and agent go away when the guide ends; the island stays where it is.",
    launchAtStartup: "Start with Windows",
    launchAtStartupHint: "The island appears after you sign in",
    later: "These take one more step, now or later:",
    connectAgents: "Connect AI coding tools",
    addMail: "Add a mail account",
    openSettings: "Open Settings",
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
