export type SessionRingText = {
  needs: string;
  yourturn: string;
  working: string;
  stale: string;
  done: string;
  empty: string;
  sessionLine: (state: string, name: string) => string;
  openAgents: (summary: string) => string;
  settings: {
    title: string;
    footer: string;
    style: string;
    styles: { grid: string; ring: string; bar: string; signal: string };
    styleHints: { grid: string; ring: string; bar: string; signal: string };
    showCount: string;
    showCountHint: string;
  };
};

export const zhCN: SessionRingText = {
  needs: "等你确认",
  yourturn: "等你回复",
  working: "运行",
  stale: "可能已停",
  done: "完成",
  empty: "没有 Agent 会话",
  sessionLine: (state, name) => `${state}：${name}`,
  openAgents: (summary) => `${summary}，点击打开 Agent 页`,
  settings: {
    title: "会话环",
    footer: "在收起条上代替蓝色会话数：等你确认、等你回复、运行、完成各有颜色，悬停列出等你处理的会话，点击打开 Agent 页。显示的就是 Agent 页列出的会话，AI Agent 关闭时不显示。在 设置 → 插件（第 3 版）里关掉内置插件「会话环」，这一节和收起条上的环一起隐藏。",
    style: "样式",
    styles: { grid: "像素格", ring: "分段环", bar: "状态条", signal: "信号格" },
    styleHints: { grid: "2×2 或 3×3 状态色点阵", ring: "四色圆环，中间可显总数", bar: "总数加按比例分段横条", signal: "四根竖柱逐格点亮" },
    showCount: "显示会话数",
    showCountHint: "分段环中间和状态条前面的数字。关掉后只看颜色比例；像素格和信号格本来就不写数字。",
  },
};

export const en: SessionRingText = {
  needs: "Needs you",
  yourturn: "Your turn",
  working: "Running",
  stale: "Maybe stalled",
  done: "Done",
  empty: "No agent sessions",
  sessionLine: (state, name) => `${state}: ${name}`,
  openAgents: (summary) => `${summary}. Click to open the Agent page`,
  settings: {
    title: "Session ring",
    footer: "Takes the blue session count's place on the collapsed bar: needs you, your turn, running and done each have a colour; hovering lists the sessions waiting on you and a click opens the Agent page. It shows exactly the sessions the Agent page lists and hides while AI Agent is off. Switching off the built-in plugin \"Session ring\" under Settings → Plugins (v3) hides this group and the ring.",
    style: "Style",
    styles: { grid: "Pixel grid", ring: "Segmented ring", bar: "State bar", signal: "Signal bars" },
    styleHints: { grid: "2×2 or 3×3 state matrix", ring: "Four-arc ring with optional count", bar: "Proportional state strip", signal: "Four stacked signal columns" },
    showCount: "Show the count",
    showCountHint: "The number in the segmented ring and before the state bar. Off, only the colours' shares show; the pixel grid and signal bars have no number anyway.",
  },
};
