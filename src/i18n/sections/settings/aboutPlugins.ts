type Point = { title: string; body: string };

export type SettingsAboutPluginsText = {
  title: string;
  lead: string;
  stats: {
    label: string;
    builtins: string;
    builtinsOn: (on: number) => string;
    installed: string;
    installedNote: string;
    process: string;
    processOff: string;
    processNode: (version: string) => string;
    unknown: string;
  };
  actions: { label: string; manage: string; market: string; diagnostics: string };
  meaningTitle: string;
  meaning: { off: Point; add: Point; safe: Point };
  trustTitle: string;
  trust: { same: Point; guard: Point };
  buildTitle: string;
  build: {
    aiTitle: string;
    aiBody: string;
    ideaLabel: string;
    ideaPlaceholder: string;
    ideaFallback: string;
    copy: string;
    copied: string;
    copyFailed: string;
    showPrompt: string;
    caution: string;
    prompt: (idea: string) => string;
    manualTitle: string;
    body: string;
    commandLabel: string;
    docs: string;
    tutorial: string;
    base: string;
    baseHint: string;
    linksLabel: string;
  };
  learnMore: string;
};

export const zhCN: SettingsAboutPluginsText = {
  title: "自带的功能和你装的插件，跑在同一套系统上",
  lead: "待办、剪贴板、翻译这些自带功能，和从市场装的插件用的是同一套接口。所以它们都能单独关掉，也都按同一套规则运行。",
  stats: {
    label: "插件系统现在的状态",
    builtins: "自带功能",
    builtinsOn: (on) => `开着 ${on} 个`,
    installed: "已装插件",
    installedNote: "从市场或文件安装",
    process: "插件进程",
    processOff: "已关闭",
    processNode: (version) => `Node ${version}`,
    unknown: "—",
  },
  actions: { label: "插件相关的页面", manage: "管理插件", market: "逛插件市场", diagnostics: "运行诊断" },
  meaningTitle: "这对你意味着什么",
  meaning: {
    off: {
      title: "不用的功能可以关掉",
      body: "关掉一个自带功能，它在岛上的界面会撤掉，后台也跟着停，不只是藏起来。只有自动更新关不掉。",
    },
    add: {
      title: "新功能从市场加",
      body: "天气、番茄钟、GitHub 提醒这类功能在插件市场里，装和卸都不用重启浮屿。",
    },
    safe: {
      title: "一个插件出错，不拖垮岛",
      body: "插件的后台逻辑在单独的进程里运行。某个插件 60 秒内出错 5 次会被自动停用；排查问题时可以进安全模式，只留自带功能。",
    },
  },
  trustTitle: "信任与安全",
  trust: {
    same: {
      title: "插件和浮屿权限一样",
      body: "插件没有权限表，也不在沙箱里：装上的插件能做浮屿能做的事，包括读写文件和联网。只装你信得过的插件。",
    },
    guard: {
      title: "市场怎么把关",
      body: "市场的插件清单带签名，下载的包装之前会校验；第三方插件要有作者签名，作者或密钥换了会再问你一次；没审核的版本会标出来，出问题的版本可以撤回。",
    },
  },
  buildTitle: "写一个插件",
  build: {
    aiTitle: "让 AI 帮你写",
    aiBody: "写下你想要的功能，复制提示词，发给能运行命令的 AI 代理（Claude Code、Codex、Cursor 这类）。它会建项目、照文档写，并让插件出现在岛上。",
    ideaLabel: "你想要什么插件",
    ideaPlaceholder: "例如：在收起条上显示今天喝了几杯水，点开后能加一杯",
    ideaFallback: "（在这里写你想要的功能）",
    copy: "复制提示词",
    copied: "已复制",
    copyFailed: "复制失败，请展开提示词手动复制",
    showPrompt: "查看提示词",
    caution: "AI 写的插件和别的插件一样，有浮屿的全部权限。提示词会让它列出插件读写了什么、连了哪些网址，用之前看一眼。",
    prompt: (idea) => `帮我给浮屿（Fuyu，Windows 和 macOS 上的桌面悬浮岛）写一个插件。

我想要的功能：
${idea}

请按这个顺序做：
1. 建项目：在一个新文件夹里运行 \`npm create fuyu-plugin@latest <文件夹> -- --owner <我的 GitHub 用户名> --name <插件名，小写英文> --display-name <英文名> --display-name-zh <中文名> --yes\`，然后在里面运行 \`npm install\`。GitHub 用户名先问我；我没有的话用任意一个英文名，只在本机用不受影响。
2. 先读再写：读项目里的 AGENTS.md（没有就读 README.md），再读 https://github.com/TixXin/fuyu/blob/main/docs/plugins/first-plugin.md 和 https://github.com/TixXin/fuyu/blob/main/docs/plugins/services-and-slots.md 。服务、插槽和 ctx 上的方法只用文档里列出的，不要猜名字。
3. 把生成的示例改成我要的功能，示例里用不上的代码和声明删掉，名字、说明、README 和图标也换成这个插件的。界面文字中英文都要有，颜色用文档里的主题变量，package.json 里 fuyu 下的声明要和代码对得上。
4. 验证：运行 \`npm run typecheck\`、\`npm run lint\`、\`npm run check\`，都没有报错（告警可以留着）；再运行 \`npm run dev\`（浮屿要开着），让插件出现在岛上。

要求：
- 插件和浮屿权限一样，没有沙箱。只做这个功能需要的事，不读写无关的文件，不运行无关的程序，不连无关的网址。
- 做完后告诉我：这个插件读了什么、写了什么、连了哪些网址，以及我在岛上哪里能看到它。你看不到岛，所以也告诉我要我自己确认什么。
- 需求里有不清楚的地方：会改变做法的先问我，最多 3 个；其余你自己定，做完列出来。
- 如果你不能运行命令，就给我每个文件的完整内容，并告诉我每一步要运行什么。`,
    manualTitle: "自己写",
    body: "插件用 TypeScript 写，能加岛上的页面、收起条上的小块、设置项和后台服务。一条命令建好项目：",
    commandLabel: "新建插件项目的命令",
    docs: "开发文档",
    tutorial: "从零做一个插件",
    base: "开源基座 tauri-cordis",
    baseHint: "这套插件系统的内核单独开源，别的 Tauri 应用也能用",
    linksLabel: "给插件作者的链接",
  },
  learnMore: "了解插件系统",
};

export const en: SettingsAboutPluginsText = {
  title: "Built-in features and the plugins you install run on one system",
  lead: "Built-in features such as to-dos, clipboard and translation use the same interfaces as plugins from the market. That is why each can be turned off on its own, and why they all follow the same rules.",
  stats: {
    label: "The plugin system right now",
    builtins: "Built-in features",
    builtinsOn: (on) => `${on} turned on`,
    installed: "Installed plugins",
    installedNote: "From the market or a file",
    process: "Plugin process",
    processOff: "Off",
    processNode: (version) => `Node ${version}`,
    unknown: "—",
  },
  actions: { label: "Plugin pages", manage: "Manage plugins", market: "Browse the market", diagnostics: "Diagnostics" },
  meaningTitle: "What this means for you",
  meaning: {
    off: {
      title: "Turn off what you don't use",
      body: "Turning a built-in feature off removes its interface from the island and stops its background work; it isn't just hidden. Only automatic updates can't be turned off.",
    },
    add: {
      title: "Add features from the market",
      body: "Weather, a pomodoro timer, GitHub alerts and more are in the plugin market. Installing or removing one doesn't need a restart.",
    },
    safe: {
      title: "One failing plugin doesn't take the island down",
      body: "A plugin's background logic runs in a separate process. A plugin that fails 5 times in 60 seconds is switched off automatically, and safe mode keeps only the built-in features while you look for the cause.",
    },
  },
  trustTitle: "Trust and safety",
  trust: {
    same: {
      title: "Plugins have the same access as Fuyu",
      body: "Plugins have no permission list and no sandbox: an installed plugin can do what Fuyu can do, including reading and writing files and using the network. Install only plugins you trust.",
    },
    guard: {
      title: "How the market checks plugins",
      body: "The market's plugin list is signed, and a downloaded package is verified before it is installed. Third-party plugins must be signed by their author, and you are asked again if the author or key changes. Unreviewed versions are labelled, and a bad version can be revoked.",
    },
  },
  buildTitle: "Write a plugin",
  build: {
    aiTitle: "Let an AI write it",
    aiBody: "Describe what you want, copy the prompt and give it to an AI agent that can run commands (Claude Code, Codex, Cursor and the like). It sets up the project, follows the docs and puts the plugin on the island.",
    ideaLabel: "The plugin you want",
    ideaPlaceholder: "For example: show today's glasses of water on the collapsed bar, and open it to add a glass",
    ideaFallback: "(describe what you want here)",
    copy: "Copy prompt",
    copied: "Copied",
    copyFailed: "Couldn't copy. Open the prompt and copy it by hand.",
    showPrompt: "Show the prompt",
    caution: "A plugin written by an AI has all of Fuyu's access, like any other plugin. The prompt asks it to list what the plugin reads, writes and connects to; read that list before you use it.",
    prompt: (idea) => `Write a plugin for Fuyu, a floating island for the desktop on Windows and macOS.

What I want:
${idea}

Work in this order:
1. Set up the project: in a new folder run \`npm create fuyu-plugin@latest <folder> -- --owner <my GitHub user name> --name <plugin name, lowercase> --display-name <name in English> --display-name-zh <name in Chinese> --yes\`, then \`npm install\` inside it. Ask me for my GitHub user name first; if I have none, any name will do, since it only matters when publishing.
2. Read before writing: the project's AGENTS.md (README.md if there is none), then https://github.com/TixXin/fuyu/blob/main/docs/plugins/first-plugin.md and https://github.com/TixXin/fuyu/blob/main/docs/plugins/services-and-slots.md . Use only the services, slots and ctx members listed there; never guess a name.
3. Turn the generated example into what I asked for, and delete the code and declarations of the example that are no longer used; make the name, description, README and icon this plugin's own. Every visible string in English and Chinese, colors from the theme variables in the docs, and the declarations under fuyu in package.json matching the code.
4. Verify: \`npm run typecheck\`, \`npm run lint\` and \`npm run check\` finish without errors (warnings may stay); then \`npm run dev\` (Fuyu must be running) so the plugin shows up on the island.

Rules:
- A plugin has the same access as Fuyu, with no sandbox. Do only what this feature needs: no unrelated files, programs or network hosts.
- When done, tell me what the plugin reads, what it writes, which hosts it contacts, and where on the island I can see it. You cannot see the island, so also tell me what to check myself.
- If the request is unclear: ask me first about what would change the approach, three questions at most; decide the rest yourself and list those decisions when done.
- If you cannot run commands, give me the full content of every file and tell me what to run at each step.`,
    manualTitle: "Write it yourself",
    body: "Plugins are written in TypeScript and can add island pages, items on the collapsed bar, settings and background services. One command sets up a project:",
    commandLabel: "Command that creates a plugin project",
    docs: "Developer guide",
    tutorial: "Your first plugin",
    base: "Open-source base: tauri-cordis",
    baseHint: "The kernel of this plugin system is open source on its own, so other Tauri apps can use it",
    linksLabel: "Links for plugin authors",
  },
  learnMore: "About the plugin system",
};
