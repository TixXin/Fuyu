const en = {
  title: "Pomodoro",
  focus: "Focusing",
  ready: "Ready to focus",
  rounds: (count: number) => `Done today: ${count}`,
  start: "Start 25:00",
  startWithTodo: "Start on selected todo",
  stop: "Stop",
  noTodo: "Focus without a todo",
  openTodos: "Open todos today",
  emptyTodos: "No open todos today",
};

const zhCN: typeof en = {
  title: "番茄钟",
  focus: "专注中",
  ready: "准备开始",
  rounds: (count: number) => `今日已完成 ${count} 轮`,
  start: "开始 25:00",
  startWithTodo: "开始所选待办",
  stop: "停止",
  noTodo: "不关联待办直接专注",
  openTodos: "今日未完成待办",
  emptyTodos: "今天暂无未完成待办",
};

const isZh = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh");

export const text = isZh ? zhCN : en;
