export type AgentNoticeText = {
  headline: {
    working: (tool: string | null) => string;
    needs: (tool: string) => string;
    question: string;
    yourTurn: string;
    done: string;
    failed: string;
  };
  state: Record<"working" | "needs" | "yourTurn" | "done" | "failed" | "question", string>;
  agent: string;
  wants: (tool: string) => string;
  openPage: string;
  focusWindow: string;
  count: (index: number, total: number) => string;
  you: (prompt: string) => string;
  model: (label: string) => string;
};

export const zhCN: AgentNoticeText = {
  headline: {
    working: (tool) => (tool ? `运行中 · ${tool}` : "运行中"),
    needs: (tool) => `等你确认 · ${tool}`,
    question: "等你回答",
    yourTurn: "等你回复",
    done: "这一轮完成了",
    failed: "出错了",
  },
  state: { working: "运行中", needs: "等你确认", yourTurn: "等你回复", done: "完成", failed: "出错", question: "等你回答" },
  agent: "AI Agent",
  wants: (tool) => `想运行 ${tool}：`,
  openPage: "打开 Agent 页",
  focusWindow: "切到会话所在的窗口",
  count: (index, total) => `${index}/${total}`,
  you: (prompt) => `你：${prompt}`,
  model: (label) => `模型：${label}`,
};

export const en: AgentNoticeText = {
  headline: {
    working: (tool) => (tool ? `Running · ${tool}` : "Running"),
    needs: (tool) => `Approve ${tool}?`,
    question: "Question for you",
    yourTurn: "Waiting for you",
    done: "Turn finished",
    failed: "Failed",
  },
  state: { working: "Running", needs: "Approve?", yourTurn: "Your turn", done: "Done", failed: "Failed", question: "Question" },
  agent: "AI Agent",
  wants: (tool) => `Wants to run ${tool}:`,
  openPage: "Open the Agent page",
  focusWindow: "Switch to the session's window",
  count: (index, total) => `${index}/${total}`,
  you: (prompt) => `You: ${prompt}`,
  model: (label) => `Model: ${label}`,
};
