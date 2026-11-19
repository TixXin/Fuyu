export type AgentNoticeStackText = {
  list: string;
  showAll: (count: number) => string;
};

export const zhCN: AgentNoticeStackText = {
  list: "同时要你处理的会话",
  showAll: (count) => `还有 ${count} 个会话，展开列表`,
};

export const en: AgentNoticeStackText = {
  list: "Sessions waiting on you",
  showAll: (count) => `${count} more ${count === 1 ? "session" : "sessions"}, show the list`,
};
