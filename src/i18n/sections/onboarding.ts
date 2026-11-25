import { en as pushEn, zhCN as pushZhCN, type OnboardingPushText } from "./onboarding-push.ts";
import type { DirectorSceneGroup, DirectorSceneId } from "../../windows/onboarding/directorScenes.ts";
import type { OnboardingModule } from "../../windows/onboarding/personas.ts";

export type OnboardingFormId = "top" | "pill" | "notch" | "bottom" | "left" | "right" | "taskbar";

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
  trackLabels: Record<"firstRun" | "whatsNew" | "setup", string>;
  stages: Record<"hello" | "shape" | "outfit" | "permissions" | "play" | "release", string>;
  whatsNewStages: Record<"whatsNewNotes" | "whatsNewForms", string>;
  setupStages: Record<"agentCards" | "agentConnect" | "push", string>;
  director: {
    playing: (scene: string) => string;
    paused: string;
    userControl: string;
    pause: string;
    resume: string;
    playAll: string;
    restoreAnchor: string;
    nextScene: string;
    stripTitle: string;
    stripHint: string;
    groups: Record<DirectorSceneGroup, string>;
    scenes: Record<DirectorSceneId, string>;
    notifyTitle: string;
    notifyBody: string;
  };
  community: {
    title: string;
    collapsed: string;
    sub: string;
    hide: string;
    modalTitle: string;
    modalHint: string;
    validUntil: (date: string) => string;
    close: string;
    qrAlt: string;
  };
  hello: {
    title: string;
    lead: string;
    emblemTitle: string;
    emblemHint: string;
    language: string;
    previewLabel: string;
    previewItems: [string, string, string];
  };
  shape: {
    title: string;
    lead: string;
    formTitle: string;
    tourForms: string;
    stopTourForms: string;
    forms: Record<OnboardingFormId, string>;
    formHints: Record<OnboardingFormId, string>;
    taskbarLook: string;
    themesTitle: string;
    theme: string;
    look: string;
    solid: string;
    glassHint: string;
    jellyfishStyle: string;
    jellyVector: string;
    jellyPixel: string;
    motionTitle: string;
    playMotion: string;
    motions: Record<"pop" | "lively" | "snappy" | "soft" | "none", string>;
  };
  outfit: {
    title: string;
    lead: string;
    tourStart: string;
    tourStop: string;
    demoThis: string;
    personaQuestion: string;
    personas: Record<"code" | "office" | "study" | "fun", string>;
    list: (names: string[]) => string;
    takenOff: (names: string) => string;
    selectedCount: (on: number, total: number) => string;
    stickers: string;
    stickersHint: string;
    previewLabel: string;
    enabledBadge: string;
    disabledBadge: string;
    modules: Record<OnboardingModule, string>;
    moduleDescs: Record<OnboardingModule, string>;
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
  whatsNew: {
    title: (version: string) => string;
    upgradedFrom: (from: string, to: string) => string;
    releasedAt: (date: string) => string;
    lead: string;
    loading: string;
    empty: string;
    openHistory: string;
    formsTitle: string;
    formsLead: string;
    finish: string;
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
    summaryForm: string;
    summaryMotion: string;
    summaryModules: (count: number) => string;
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
  startTour: "开始定制浮屿",
  doneSetup: "完成配置",
  close: "关闭引导",
  escHint: "按 Esc 随时退出",
  islandName: "浮屿",
  noIsland: "岛现在藏起来了。点托盘图标让它出来，引导会跟着它。",
  noIslandMac: "岛现在藏起来了。点菜单栏里的浮屿图标让它出来，引导会跟着它。",
  trackLabels: {
    firstRun: "首次安装引导",
    whatsNew: "版本更新引导",
    setup: "进阶配置工作区",
  },
  stages: {
    hello: "认识浮屿",
    shape: "形态与外观",
    outfit: "能力全景",
    permissions: "系统权限",
    play: "上手体验",
    release: "准备就绪",
  },
  whatsNewStages: {
    whatsNewNotes: "版本说明",
    whatsNewForms: "多形态体验",
  },
  setupStages: {
    agentCards: "会话样式",
    agentConnect: "连接代理",
    push: "手机推送",
  },
  director: {
    playing: (scene) => `自动演示：${scene}`,
    paused: "自动演示已暂停",
    userControl: "已交由你操控真岛",
    pause: "暂停",
    resume: "继续演示",
    playAll: "自动连播",
    restoreAnchor: "还原原形态",
    nextScene: "下一段",
    stripTitle: "真岛实时演播台",
    stripHint: "点击任意胶囊或分组立即在真岛上演一遍；随时可碰真岛接管，切步或关闭会自动还原原位置。",
    groups: {
      forms: "形态与吸附",
      agents: "Agent 通知",
      panels: "面板展开",
    },
    scenes: {
      greet: "落岛问候",
      formPill: "悬空胶囊",
      formNotch: "刘海双翼",
      dockRight: "右侧吸附",
      dockLeft: "左侧吸附",
      dockBottom: "底边吸附",
      dockTaskbar: "任务栏嵌入",
      tuck: "贴边收起",
      collapse: "唤出回位",
      agentApproval: "审批弹窗",
      agentQuestion: "提问卡片",
      agentYourTurn: "等待回复",
      agentDone: "任务完成",
      agentFailed: "运行异常",
      agentStack: "多条堆叠",
      dashboard: "Fuyu 看板",
      agents: "Agent 页",
      music: "音乐歌词",
    },
    notifyTitle: "你好啊，我在这儿 👋",
    notifyBody: "我是浮屿，平时安静停在屏幕边缘，有事才展开。",
  },
  community: {
    title: "浮屿微信交流群",
    collapsed: "微信交流群",
    sub: "点击卡片居中放大扫码，欢迎交流与反馈",
    hide: "收起",
    modalTitle: "浮屿微信用户交流群",
    modalHint: "打开微信扫一扫加入交流群 · 点击空白处或按 Esc 关闭",
    validUntil: (date) => `当前群码有效至 ${date}`,
    close: "关闭二维码",
    qrAlt: "浮屿微信交流群二维码",
  },
  hello: {
    title: "你好，这就是浮屿",
    lead: "亮着的就是真正的岛：平时安静地停在屏幕边缘，有事才优雅变大。一分钟带你挑形态、定外观、搭功能并亲手试一下。",
    emblemTitle: "浮屿 · 你的桌面悬浮效率岛",
    emblemHint: "点一下水母切换矢量 / 像素画风",
    language: "界面语言",
    previewLabel: "接下来会一起完成",
    previewItems: ["挑形态与外观", "搭核心能力", "真岛试一下"],
  },
  shape: {
    title: "选一种形态，捏成喜欢的样子",
    lead: "每一次选择都会立刻作用于真正的岛；切换形态或开合动画时，真岛会现场演示给你看。",
    formTitle: "形态与停靠位置",
    tourForms: "轮播形态",
    stopTourForms: "停止轮播",
    forms: {
      top: "贴顶",
      pill: "悬空药丸",
      notch: "刘海",
      bottom: "底边",
      left: "左侧",
      right: "右侧",
      taskbar: "任务栏",
    },
    formHints: {
      top: "紧贴屏幕顶边，自然向下展开",
      pill: "离顶悬空 10px，四角全圆角带投影",
      notch: "贴合屏幕刘海，左右双翼显示状态",
      bottom: "贴在屏幕底边，向上展开",
      left: "竖向细条停靠屏幕左侧",
      right: "竖向细条停靠屏幕右侧",
      taskbar: "直接嵌入任务栏空白槽位",
    },
    taskbarLook: "任务栏外观",
    themesTitle: "主题与质感",
    theme: "深色还是浅色",
    look: "质感",
    solid: "纯色",
    glassHint: "透出桌面壁纸的毛玻璃。颜色、流动和模糊在「设置 → 外观 → 样式」里调。系统关掉「透明效果」或读不到壁纸（目前 Mac 上）时显示为纯色玻璃。",
    jellyfishStyle: "水母画风",
    jellyVector: "矢量",
    jellyPixel: "像素",
    motionTitle: "开合动画",
    playMotion: "真岛试播",
    motions: {
      pop: "Q 弹",
      lively: "灵动",
      snappy: "利落",
      soft: "柔和",
      none: "无动画",
    },
  },
  outfit: {
    title: "核心能力全景，按需装配",
    lead: "先选一个日常场景快速搭配，再自由增减下面各项内置能力；点击「在真岛演示」或开启自动巡礼，顶部真岛会切到对应页面展示。",
    tourStart: "自动巡礼已选",
    tourStop: "停止巡礼",
    demoThis: "在真岛打开这一页",
    personaQuestion: "你平时主要用电脑做什么？（可多选，再点一次撤回）",
    personas: {
      code: "写代码",
      office: "办公",
      study: "学习",
      fun: "娱乐",
    },
    list: (names) => names.join("、"),
    takenOff: (names) => `已卸下：${names}。点能力卡就能装回，以后在设置里也行。`,
    selectedCount: (on, total) => `已开启 ${on} / ${total}`,
    stickers: "功能贴纸",
    stickersHint: "点击卡片开关对应内置能力",
    previewLabel: "当前聚焦能力",
    enabledBadge: "已开启",
    disabledBadge: "未开启",
    modules: {
      todo: "待办",
      calendar: "日历",
      music: "音乐",
      agents: "AI Agent",
      translation: "翻译",
      shelf: "文件中转",
      mail: "邮箱",
      screenshot: "截图",
      clipboard: "剪贴板",
      timer: "计时器",
      voice: "语音输入",
    },
    moduleDescs: {
      todo: "随手记任务、项目分组与每日笔记",
      calendar: "日程提醒与收起条会前倒计时",
      music: "悬浮播放控制、律动波形与同步歌词",
      agents: "Claude / Codex 等代理状态灯、审批与用量环",
      translation: "快捷键弹窗即时翻译，不打断阅读",
      shelf: "拖到岛上暂存文件，切窗口随时拖出",
      mail: "新邮件提醒与岛内快速预览回复",
      screenshot: "选区标注、置顶贴图与录屏",
      clipboard: "全局热键秒开剪贴板历史与图片预览",
      timer: "收起条安静倒计时、番茄钟与休息提醒",
      voice: "本地离线语音转文字，直接存待办或复制",
    },
  },
  play: {
    title: "在真岛上试一下",
    lead: (song, agent) =>
      song && agent ? "岛上正放着演示歌曲和演示 Agent。亲手完成下面的小任务，每完成一个亮一颗星。"
        : song ? "岛上正放着演示歌曲。亲手完成下面的小任务，每完成一个亮一颗星。"
          : agent ? "岛上有一个演示 Agent 在干活。亲手完成下面的小任务，每完成一个亮一颗星。"
            : "亲手完成下面的小任务，每完成一个亮一颗星。",
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
  whatsNew: {
    title: (version) => (version ? `浮屿 v${version.replace(/^v/i, "")} 更新了什么` : "这个版本更新了什么"),
    upgradedFrom: (from, to) => `已从 v${from.replace(/^v/i, "")} 升级至 v${to.replace(/^v/i, "")}`,
    releasedAt: (date) => `发布于 ${date}`,
    lead: "这里汇总了本次版本的主要更新内容，接下来也可以在真岛上直接试一下新形态。",
    loading: "正在读取版本说明…",
    empty: "当前版本已更新就绪，可以在设置 → 关于 → 版本历史中查看完整记录。",
    openHistory: "查看完整版本历史",
    formsTitle: "在真岛上试试多种形态",
    formsLead: "点下面任意形态，顶部真岛会立刻切换，随时可以还原回原来的位置。",
    finish: "我知道了，继续使用",
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
    lead: "点「开始使用」后演示内容会收起，真正的岛会安静留在屏幕边缘。",
    summaryForm: "形态",
    summaryMotion: "动效",
    summaryModules: (count) => `已启 ${count} 项能力`,
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
  startTour: "Customize Fuyu",
  doneSetup: "Done",
  close: "Close the guide",
  escHint: "Press Esc to leave at any time",
  islandName: "Fuyu",
  noIsland: "The island is hidden. Click the tray icon to bring it back, and the guide will follow it.",
  noIslandMac: "The island is hidden. Click the Fuyu icon in the menu bar to bring it back, and the guide will follow it.",
  trackLabels: {
    firstRun: "First-run Tour",
    whatsNew: "What's New",
    setup: "Setup Workspace",
  },
  stages: {
    hello: "Welcome",
    shape: "Form & Look",
    outfit: "Capabilities",
    permissions: "Permissions",
    play: "Try it",
    release: "Ready",
  },
  whatsNewStages: {
    whatsNewNotes: "Release Notes",
    whatsNewForms: "Try Forms",
  },
  setupStages: {
    agentCards: "Layout",
    agentConnect: "Connect",
    push: "Phone push",
  },
  director: {
    playing: (scene) => `Auto-demo: ${scene}`,
    paused: "Auto-demo paused",
    userControl: "You're in control",
    pause: "Pause",
    resume: "Resume",
    playAll: "Play reel",
    restoreAnchor: "Restore form",
    nextScene: "Next scene",
    stripTitle: "Live island showcase",
    stripHint: "Click any scene or group to watch it live on the real island; your original position restores automatically.",
    groups: {
      forms: "Forms & dock",
      agents: "Agent alerts",
      panels: "Panels",
    },
    scenes: {
      greet: "Greeting",
      formPill: "Floating pill",
      formNotch: "Notch wings",
      dockRight: "Dock right",
      dockLeft: "Dock left",
      dockBottom: "Dock bottom",
      dockTaskbar: "Taskbar",
      tuck: "Edge tuck",
      collapse: "Reveal back",
      agentApproval: "Approval",
      agentQuestion: "Question",
      agentYourTurn: "Your turn",
      agentDone: "Done",
      agentFailed: "Failed",
      agentStack: "Stacked",
      dashboard: "Fuyu panel",
      agents: "Agents tab",
      music: "Music tab",
    },
    notifyTitle: "Hi there, I'm up here 👋",
    notifyBody: "I'm Fuyu — quiet at the screen edge until something needs you.",
  },
  community: {
    title: "WeChat Community",
    collapsed: "WeChat Group",
    sub: "Click card to enlarge & scan with WeChat",
    hide: "Hide",
    modalTitle: "Fuyu WeChat Community",
    modalHint: "Scan with WeChat to join · Click backdrop or press Esc to close",
    validUntil: (date) => `QR valid through ${date}`,
    close: "Close QR code",
    qrAlt: "Fuyu WeChat community QR code",
  },
  hello: {
    title: "Hi, this is Fuyu",
    lead: "That's the real island lit up above: quiet while you focus, expanding when something needs you. Take a minute to pick its form, look, and tools.",
    emblemTitle: "Fuyu · Your Floating Desktop Island",
    emblemHint: "Click the jellyfish to switch Vector / Pixel",
    language: "Language",
    previewLabel: "What we'll do next",
    previewItems: ["Form & look", "Pick tools", "Try it live"],
  },
  shape: {
    title: "Pick a form and shape it your way",
    lead: "Every change applies live to the real island. Try switching forms or motion presets to watch it react.",
    formTitle: "Form & Docking",
    tourForms: "Tour forms",
    stopTourForms: "Stop tour",
    forms: {
      top: "Top",
      pill: "Pill",
      notch: "Notch",
      bottom: "Bottom",
      left: "Left",
      right: "Right",
      taskbar: "Taskbar",
    },
    formHints: {
      top: "Flush against the top screen edge",
      pill: "Floats 10px below the top with soft shadow",
      notch: "Wraps the display notch with left & right wings",
      bottom: "Docks along the bottom edge and opens upward",
      left: "Slim vertical bar docked on the left edge",
      right: "Slim vertical bar docked on the right edge",
      taskbar: "Embeds directly inside the Windows taskbar",
    },
    taskbarLook: "Taskbar look",
    themesTitle: "Themes & Surface",
    theme: "Dark or light",
    look: "Surface",
    solid: "Solid",
    glassHint: "Frosted glass showing your desktop wallpaper. Colors, flow and blur are in Settings → Appearance → Style. With Transparency effects off, or no wallpaper to read (on Mac for now), the glass stays solid.",
    jellyfishStyle: "Jellyfish",
    jellyVector: "Vector",
    jellyPixel: "Pixel",
    motionTitle: "Open/close motion",
    playMotion: "Play live",
    motions: {
      pop: "Pop",
      lively: "Lively",
      snappy: "Snappy",
      soft: "Soft",
      none: "None",
    },
  },
  outfit: {
    title: "Choose the capabilities you'll use",
    lead: "Start with a preset that matches your workflow, then toggle built-in capabilities and preview any tab live on the real island.",
    tourStart: "Auto-tour enabled",
    tourStop: "Stop tour",
    demoThis: "Open on real island",
    personaQuestion: "What do you mostly use your computer for? (Pick any; click again to undo)",
    personas: {
      code: "Coding",
      office: "Work",
      study: "Study",
      fun: "Leisure",
    },
    list: (names) => names.join(", "),
    takenOff: (names) => `Taken off: ${names}. Click a card to put one back, or do it in Settings later.`,
    selectedCount: (on, total) => `${on} / ${total} on`,
    stickers: "Feature stickers",
    stickersHint: "Click any card to turn that capability on or off",
    previewLabel: "Focused capability",
    enabledBadge: "Enabled",
    disabledBadge: "Off",
    modules: {
      todo: "Todos",
      calendar: "Calendar",
      music: "Music",
      agents: "AI agents",
      translation: "Translate",
      shelf: "File shelf",
      mail: "Mail",
      screenshot: "Screenshots",
      clipboard: "Clipboard",
      timer: "Timer",
      voice: "Voice input",
    },
    moduleDescs: {
      todo: "Quick tasks, project groups & daily notes",
      calendar: "Schedules & collapsed pre-meeting countdown",
      music: "Floating controls, live wave & synced lyrics",
      agents: "Status lights, inline approvals & usage rings",
      translation: "Instant hotkey translation popup",
      shelf: "Drop files to hold & drag out anywhere",
      mail: "Incoming mail alerts & quick replies",
      screenshot: "Snip, pin on top & screen recording",
      clipboard: "Global hotkey history & image previews",
      timer: "Collapsed countdown, Pomodoro & break alerts",
      voice: "Offline local speech-to-text into todos",
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
  whatsNew: {
    title: (version) => (version ? `What's new in Fuyu v${version.replace(/^v/i, "")}` : "What's new in this update"),
    upgradedFrom: (from, to) => `Updated from v${from.replace(/^v/i, "")} to v${to.replace(/^v/i, "")}`,
    releasedAt: (date) => `Released ${date}`,
    lead: "Here are the highlights of this release, followed by a quick live preview of island forms.",
    loading: "Loading release notes…",
    empty: "You're up to date. Full notes are always available in Settings → About → Version history.",
    openHistory: "View full version history",
    formsTitle: "Try Fuyu's island forms live",
    formsLead: "Click any form below to see the real island transform immediately.",
    finish: "Got it, continue",
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
    lead: "Click Get started to clear the demo content and keep Fuyu ready at the edge of your screen.",
    summaryForm: "Form",
    summaryMotion: "Motion",
    summaryModules: (count) => `${count} tools active`,
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
