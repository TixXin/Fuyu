export type SettingsExpandText = {
  title: string;
  trigger: string;
  click: string;
  hover: string;
  hoverDelay: string;
  hoverCollapseDelay: string;
  /** Resting the pointer on a page dot of the expanded island opens that page. */
  hoverSwitchPage: string;
  hoverSwitchPageHint: string;
  hoverSwitchDelay: string;
  /** Title of the group for tucking to the screen edge. */
  tuckTitle: string;
  /** Title of the group for how a tucked island comes back. */
  revealTitle: string;
  /** Times the idle timer does not tuck the island (issue #29). */
  holdTodo: string;
  holdTodoHint: string;
  holdAgent: string;
  holdAgentHint: string;
  holdMusic: string;
  holdMusicHint: string;
  revealOnMessage: string;
  /** What hovering an island tucked to the edge does. */
  tuckedHover: string;
  tuckedHoverReveal: string;
  tuckedHoverExpand: string;
};

export const zhCN: SettingsExpandText = {
  title: "展开",
  trigger: "展开方式",
  click: "点击",
  hover: "鼠标悬停",
  hoverDelay: "悬停多久后展开",
  hoverCollapseDelay: "鼠标移开后收起前等待",
  hoverSwitchPage: "悬停切换页面",
  hoverSwitchPageHint: "鼠标停在展开后顶部的页面圆点上，就切到那一页，不用点击",
  hoverSwitchDelay: "悬停多久后切换",
  tuckTitle: "贴边隐藏",
  revealTitle: "露出",
  holdTodo: "有正在进行的待办时不收起",
  holdTodoHint: "点了「开始」、岛上正显示这件事时，一直留在屏幕上。",
  holdAgent: "Agent 在等你时不收起",
  holdAgentHint: "有会话在等你审批或回答时，一直留在屏幕上。",
  holdMusic: "音乐播放中不收起",
  holdMusicHint: "播放音乐时一直留在屏幕上。暂停或停止后，重新从头计时。",
  revealOnMessage: "有新消息时露出",
  tuckedHover: "鼠标移到隐藏的岛上",
  tuckedHoverReveal: "只露出岛屿",
  tuckedHoverExpand: "展开面板",
};

export const en: SettingsExpandText = {
  title: "Opening",
  trigger: "Open the island by",
  click: "Click",
  hover: "Hover",
  hoverDelay: "Hover time before opening",
  hoverCollapseDelay: "Wait before closing after leaving",
  hoverSwitchPage: "Switch pages on hover",
  hoverSwitchPageHint: "Resting the pointer on a page dot at the top of the open island opens that page, no click needed",
  hoverSwitchDelay: "Hover time before switching",
  tuckTitle: "Tuck to edge",
  revealTitle: "Sliding out",
  holdTodo: "Stay out while a todo is in progress",
  holdTodoHint: "While a todo you started shows on the island, it stays on screen.",
  holdAgent: "Stay out while an agent waits for you",
  holdAgentHint: "While a session waits for your approval or answer, the island stays on screen.",
  holdMusic: "Stay out while music plays",
  holdMusicHint: "While music plays, the island stays on screen. Paused or stopped, the idle time starts again.",
  revealOnMessage: "Slide out for new messages",
  tuckedHover: "Pointer on a tucked island",
  tuckedHoverReveal: "Slides it out",
  tuckedHoverExpand: "Opens the panel",
};
