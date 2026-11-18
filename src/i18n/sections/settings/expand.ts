export type SettingsExpandText = {
  title: string;
  trigger: string;
  click: string;
  hover: string;
  clickCollapseOnLeave: string;
  clickCollapseOnLeaveHint: string;
  hoverDelay: string;
  hoverCollapseDelay: string;
  hoverSwitchPage: string;
  hoverSwitchPageHint: string;
  hoverSwitchDelay: string;
  tuckTitle: string;
  revealTitle: string;
  holdTodo: string;
  holdTodoHint: string;
  holdAgent: string;
  holdAgentHint: string;
  holdMusic: string;
  holdMusicHint: string;
  holdMusicElsewhere: string;
  holdMessages: string;
  holdMessagesHint: string;
  revealOnMessage: string;
  tuckedHover: string;
  tuckedHoverReveal: string;
  tuckedHoverExpand: string;
  tuckStyle: string;
  tuckStyleHint: string;
  tuckStyleEdge: string;
  tuckStyleLine: string;
  tuckStyleHidden: string;
  motion: string;
  motionHint: string;
  motionSpring: string;
  motionSmooth: string;
  motionFast: string;
  motionBouncy: string;
  motionNone: string;
  motionPlay: string;
  motionCurve: string;
  clickHint: string;
  hoverHint: string;
  instant: string;
  pageKeys: string;
  pageKeysHint: string;
  pageKeysOpen: string;
  tuckIntro: string;
  alertsTitle: string;
};

export const zhCN: SettingsExpandText = {
  title: "展开",
  trigger: "展开方式",
  click: "点击",
  hover: "鼠标悬停",
  clickCollapseOnLeave: "鼠标移开后自动收起",
  clickCollapseOnLeaveHint: "点开面板看完后，鼠标移出就自动收起，不用再点外部",
  hoverDelay: "悬停多久后展开",
  hoverCollapseDelay: "鼠标移开后收起前等待",
  hoverSwitchPage: "悬停切换页面",
  hoverSwitchPageHint: "鼠标停在展开后顶部的页面图标上，就切到那一页，不用点击；划过的图标不会切换",
  hoverSwitchDelay: "悬停多久后切换",
  tuckTitle: "贴边隐藏",
  revealTitle: "露出",
  holdTodo: "有正在进行的待办时不收起",
  holdTodoHint: "点了「开始」、岛上正显示这件事时，一直留在屏幕上。",
  holdAgent: "Agent 在等你时不收起",
  holdAgentHint: "有会话在等你审批或回答时，一直留在屏幕上。",
  holdMusic: "音乐播放中不收起",
  holdMusicHint: "播放音乐时一直留在屏幕上。暂停或停止后，重新从头计时。",
  holdMusicElsewhere: "播放音乐时岛一直留在屏幕上。和「行为 → 贴边隐藏」里的是同一个开关，打开了自动收起才起作用。",
  holdMessages: "有未读消息时不收起",
  holdMessagesHint: "微信、QQ 有没看的消息，或来了新邮件、还没在消息页看过时，一直留在屏幕上。没打开的消息来源不算。",
  revealOnMessage: "有新消息时露出",
  tuckedHover: "鼠标移到隐藏的岛上",
  tuckedHoverReveal: "只露出岛屿",
  tuckedHoverExpand: "展开面板",
  tuckStyle: "露出样式",
  tuckStyleHint: "顶边和底边贴边隐藏后露出的厚度；贴边隐身时完全不显露，鼠标推到屏幕边缘 2px 热区照常唤醒",
  tuckStyleEdge: "标准露边",
  tuckStyleLine: "极简细线",
  tuckStyleHidden: "贴边隐身",
  motion: "开合动画",
  motionHint: "弹性同官网；Q 弹冲出去再轻轻回一下，高度也会弹；平滑和快速收起更快、不回弹",
  motionSpring: "弹性（同官网）",
  motionSmooth: "平滑",
  motionFast: "快速",
  motionBouncy: "Q 弹",
  motionNone: "无动画",
  motionPlay: "播放一次",
  motionCurve: "动画曲线",
  clickHint: "点一下小岛才展开",
  hoverHint: "鼠标移上去就展开，移开收起",
  instant: "立即",
  pageKeys: "页面切换快捷键",
  pageKeysHint: "数字键切页、上一页和下一页，在「快捷键 › 岛上」里改。",
  pageKeysOpen: "去设置",
  tuckIntro: "贴边隐藏时，岛屿贴到屏幕顶部，只露出一条边；鼠标移上去或有新消息时再露出。",
  alertsTitle: "在小岛上提示",
};

export const en: SettingsExpandText = {
  title: "Opening",
  trigger: "Open the island by",
  click: "Click",
  hover: "Hover",
  clickCollapseOnLeave: "Close when pointer leaves",
  clickCollapseOnLeaveHint: "Closes the panel after the pointer leaves, without clicking outside",
  hoverDelay: "Hover time before opening",
  hoverCollapseDelay: "Wait before closing after leaving",
  hoverSwitchPage: "Switch pages on hover",
  hoverSwitchPageHint: "Resting the pointer on a page icon at the top of the open island opens that page, no click needed; icons the pointer passes over do not",
  hoverSwitchDelay: "Hover time before switching",
  tuckTitle: "Tuck to edge",
  revealTitle: "Sliding out",
  holdTodo: "Stay out while a todo is in progress",
  holdTodoHint: "While a todo you started shows on the island, it stays on screen.",
  holdAgent: "Stay out while an agent waits for you",
  holdAgentHint: "While a session waits for your approval or answer, the island stays on screen.",
  holdMusic: "Stay out while music plays",
  holdMusicHint: "While music plays, the island stays on screen. Paused or stopped, the idle time starts again.",
  holdMusicElsewhere: "While music plays, the island stays on screen. It is the same switch as in Behavior → Tuck to edge, and works only when auto tuck is on.",
  holdMessages: "Stay out while messages are unread",
  holdMessagesHint: "While WeChat or QQ has unread messages, or new mail you haven't looked at on the messages page, it stays on screen. Sources you turned off don't count.",
  revealOnMessage: "Slide out for new messages",
  tuckedHover: "Pointer on a tucked island",
  tuckedHoverReveal: "Slides it out",
  tuckedHoverExpand: "Opens the panel",
  tuckStyle: "Tucked edge",
  tuckStyleHint: "How much of the island stays visible when tucked at the top or bottom edge; Hidden leaves a 2px wake strip at the screen edge",
  tuckStyleEdge: "Standard edge",
  tuckStyleLine: "Thin line",
  tuckStyleHidden: "Hidden",
  motion: "Open and close",
  motionHint: "Spring moves as the website's island; Bouncy springs out and back, its height bounces too; Smooth and Fast close quicker, without a bounce",
  motionSpring: "Spring (as the website)",
  motionSmooth: "Smooth",
  motionFast: "Fast",
  motionBouncy: "Bouncy",
  motionNone: "None",
  motionPlay: "Play it",
  motionCurve: "Animation curve",
  clickHint: "Opens only when you click the island",
  hoverHint: "Opens under the pointer, closes when it leaves",
  instant: "At once",
  pageKeys: "Page switching keys",
  pageKeysHint: "Number keys, next page and previous page are set under Shortcuts › On the island.",
  pageKeysOpen: "Open",
  tuckIntro: "A tucked island sits against the top of the screen with only an edge showing; it slides out under the pointer or for a new message.",
  alertsTitle: "Shown on the island",
};
