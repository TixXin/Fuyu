export type OnboardingPushPlatform = "feishu" | "telegram" | "discord" | "weixin";

export type OnboardingPushText = {
  title: string;
  lead: string;
  steps: [string, string, string, string, string];
  stepOf: (step: number, name: string) => string;
  skipAct: string;
  thisComputer: string;
  install: {
    lead: string;
    installed: string;
    running: string;
    missing: string;
    install: string;
    installing: string;
    reading: string;
    macLocal: string;
    remoteSoon: string;
  };
  projects: {
    ask: string;
    agree: string;
    lead: string;
    none: string;
    nameLabel: (computer: string, agent: string) => string;
    problems: Record<"invalid" | "duplicate" | "taken", string>;
  };
  platform: {
    lead: string;
    recommended: string;
    names: Record<OnboardingPushPlatform, string>;
    hints: Record<OnboardingPushPlatform, string>;
    create: string;
    guide: string;
  };
  connect: {
    lead: (platform: string) => string;
    none: string;
    scan: string;
    scanWaiting: string;
    scanQr: string;
    scanOpen: string;
    scanBusy: string;
    cancel: string;
    retry: string;
    token: string;
    check: string;
    find: string;
    checking: string;
    bot: (name: string) => string;
    invite: string;
    senders: string;
    noSenders: string;
    allowFrom: string;
    connect: string;
    connecting: string;
    connected: string;
  };
  test: {
    lead: string;
    none: string;
    received: string;
    waiting: string;
    notRunning: string;
    send: string;
    sending: string;
    sent: string;
    message: string;
  };
};

export const zhCN: OnboardingPushText = {
  title: "推送到手机",
  lead: "Agent 做完或等你回复时，把消息推到手机，也能在手机上直接回它。经 cc-connect 接一个聊天机器人就行。",
  steps: ["安装", "建项目", "选平台", "接机器人", "测试"],
  stepOf: (step, name) => `第 ${step} 步，共 5 步：${name}`,
  skipAct: "先不设置推送",
  thisComputer: "本机",
  install: {
    lead: "每台电脑上都要有 cc-connect。下面是本机和 SSH 远程里开着的电脑：",
    installed: "已安装",
    running: "运行中",
    missing: "未安装",
    install: "安装",
    installing: "正在安装…",
    reading: "正在读取…",
    macLocal: "Mac 本机暂不支持，可以给远程电脑配。",
    remoteSoon: "远程电脑在引导里安装和建项目即将支持，现在可以先在那台电脑上自己装。",
  },
  projects: {
    ask: "给每台电脑上的每个 AI 代理各建一个 cc-connect 项目，一个项目接手机上的一个机器人。这样可以吗？",
    agree: "可以，列出来",
    lead: "去掉不要的，名字可以改（只用字母、数字、- 和 _）：",
    none: "还没有装好 cc-connect 的电脑，回上一步先安装。",
    nameLabel: (computer, agent) => `${computer} 上 ${agent} 的项目名`,
    problems: { invalid: "只能用字母、数字、- 和 _", duplicate: "和另一个项目重名", taken: "这台电脑上已有同名项目" },
  },
  platform: {
    lead: "选一个放机器人的聊天平台。给机器人起名时用项目名，手机上好认。",
    recommended: "推荐",
    names: { feishu: "飞书", telegram: "Telegram", discord: "Discord", weixin: "微信" },
    hints: {
      feishu: "用飞书 App 扫码，自动建好机器人",
      telegram: "找 @BotFather 建机器人，贴 token",
      discord: "在开发者门户建应用，贴 token",
      weixin: "只能对话，不推荐，这里不能选",
    },
    create: "建机器人",
    guide: "官方教程",
  },
  connect: {
    lead: (platform) => `每个项目接一个${platform}机器人。接好一个才写进配置，一个一个来。`,
    none: "上一步没有选项目。",
    scan: "扫码创建",
    scanWaiting: "正在准备二维码…",
    scanQr: "用飞书 App 扫这个二维码",
    scanOpen: "在浏览器打开",
    scanBusy: "先扫完另一个二维码",
    cancel: "取消",
    retry: "重试",
    token: "机器人 token",
    check: "检查",
    find: "识别",
    checking: "正在检查…",
    bot: (name) => `机器人 ${name} 可用`,
    invite: "邀请进服务器",
    senders: "给机器人发过消息的人，点选你自己：",
    noSenders: "先用 Telegram 给机器人发一句话，再点「识别」。",
    allowFrom: "你的用户 ID",
    connect: "接上",
    connecting: "正在接上…",
    connected: "已接上",
  },
  test: {
    lead: "在手机上给每个机器人发一句话，收到后这里会打勾，再发一条测试消息回手机。",
    none: "还没有接上的项目。",
    received: "已收到手机发来的消息",
    waiting: "还没收到：在手机上给机器人发一句话",
    notRunning: "cc-connect 没在运行，收不到消息",
    send: "发测试消息",
    sending: "正在发送…",
    sent: "已发出，看看手机",
    message: "这是浮屿发来的测试消息，看到就说明推送接好了。",
  },
};

export const en: OnboardingPushText = {
  title: "Push to your phone",
  lead: "When an agent finishes or waits for you, send it to your phone, and reply from there. A chat bot through cc-connect does it.",
  steps: ["Install", "Projects", "Platform", "Bots", "Test"],
  stepOf: (step, name) => `Step ${step} of 5: ${name}`,
  skipAct: "Skip push for now",
  thisComputer: "This computer",
  install: {
    lead: "Each computer needs cc-connect. Here are this computer and the ones turned on under SSH remote:",
    installed: "Installed",
    running: "Running",
    missing: "Not installed",
    install: "Install",
    installing: "Installing…",
    reading: "Reading…",
    macLocal: "Not supported on this Mac yet; you can set up remote computers.",
    remoteSoon: "Installing and adding projects on remote computers from the guide is coming soon; install it there yourself for now.",
  },
  projects: {
    ask: "Make one cc-connect project for each AI agent on each computer? Each project gets its own bot on your phone.",
    agree: "Yes, list them",
    lead: "Untick the ones you don't want; names can change (letters, digits, - and _ only):",
    none: "No computer has cc-connect yet. Go back a step and install it.",
    nameLabel: (computer, agent) => `Project name for ${agent} on ${computer}`,
    problems: { invalid: "Letters, digits, - and _ only", duplicate: "Same name as another project", taken: "That computer already has a project with this name" },
  },
  platform: {
    lead: "Pick a chat platform for the bots. Name each bot after its project so it is easy to tell apart on your phone.",
    recommended: "Recommended",
    names: { feishu: "Feishu", telegram: "Telegram", discord: "Discord", weixin: "WeChat" },
    hints: {
      feishu: "Scan with the Feishu app and the bot is made for you",
      telegram: "Make a bot with @BotFather and paste its token",
      discord: "Make an app in the developer portal and paste its token",
      weixin: "Chat only, not recommended; can't be picked here",
    },
    create: "Make a bot",
    guide: "Official guide",
  },
  connect: {
    lead: (platform) => `Give each project a ${platform} bot. A project is written to the config only once its bot is connected; one at a time.`,
    none: "No projects were picked in the last step.",
    scan: "Scan to create",
    scanWaiting: "Getting the QR code…",
    scanQr: "Scan this QR code with the Feishu app",
    scanOpen: "Open in browser",
    scanBusy: "Finish the other QR code first",
    cancel: "Cancel",
    retry: "Try again",
    token: "Bot token",
    check: "Check",
    find: "Find",
    checking: "Checking…",
    bot: (name) => `Bot ${name} works`,
    invite: "Invite to server",
    senders: "People who messaged the bot; pick yourself:",
    noSenders: "Send the bot a message in Telegram first, then press Find.",
    allowFrom: "Your user ID",
    connect: "Connect",
    connecting: "Connecting…",
    connected: "Connected",
  },
  test: {
    lead: "Send each bot a message from your phone. A tick shows up here once it arrives; then send a test message back.",
    none: "No project is connected yet.",
    received: "Got a message from your phone",
    waiting: "Nothing yet: send the bot a message from your phone",
    notRunning: "cc-connect is not running, so messages can't arrive",
    send: "Send a test",
    sending: "Sending…",
    sent: "Sent; check your phone",
    message: "This is a test message from Fuyu. If you can see it, push is set up.",
  },
};
