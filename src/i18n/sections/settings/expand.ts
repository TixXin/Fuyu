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
  fuyuTabIcon: string;
  fuyuTabIconHint: string;
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
  tuckHint: string;
  tuckHintHint: string;
  tuckHintNone: string;
  tuckHintDot: string;
  tuckHintGlow: string;
  tuckHintColor: string;
  tuckHintColorContrast: string;
  tuckHintColorIsland: string;
  tuckHintColorCustom: string;
  tuckHintCustomColor: string;
  tuckHintBreathe: string;
  tuckHintBreatheHint: string;
  motion: string;
  motionHint: string;
  motionPop: string;
  motionLively: string;
  motionSpring: string;
  motionSnappy: string;
  motionSoft: string;
  motionUnfold: string;
  motionGrow: string;
  motionSmooth: string;
  motionFast: string;
  motionBouncy: string;
  motionNone: string;
  motionPlay: string;
  motionCurve: string;
  hoverEffect: string;
  hoverMotionHint: string;
  hoverBounce: string;
  hoverNear: string;
  hoverSubtle: string;
  hoverBold: string;
  hoverDrop: string;
  hoverTouch: string;
  hoverNone: string;
  hoverTry: string;
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
  fuyuTabIcon: "Fuyu 页标签用图标",
  fuyuTabIconHint: "展开后顶部最左边的 Fuyu 页标签换成水母图标，不显示文字",
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
  tuckHint: "隐身提示",
  tuckHintHint: "贴边隐身时在屏幕边缘留一个很小的记号，表示岛还在运行；记号不挡鼠标",
  tuckHintNone: "无",
  tuckHintDot: "小圆点",
  tuckHintGlow: "光晕",
  tuckHintColor: "提示颜色",
  tuckHintColorContrast: "白色描边",
  tuckHintColorIsland: "跟随岛色",
  tuckHintColorCustom: "自选",
  tuckHintCustomColor: "自选颜色",
  tuckHintBreathe: "提示呼吸",
  tuckHintBreatheHint: "提示慢慢明暗变化；系统开了减少动画时一直常亮",
  motion: "开合动画",
  motionHint: "弹开（默认）一下子张开、宽度先冲过头再回来，高度慢半拍，内容由模糊变清楚，收起时内容先消失再收拢；灵动快速冲出去、微微回一下，内容由模糊变清楚；弹性同官网；利落很快到位；柔弹几乎不弹；先横后竖先拉开再落下；生长的内容从岛里长出来；Q 弹会弹几下；平滑和快速不回弹",
  motionPop: "弹开",
  motionLively: "灵动",
  motionSpring: "弹性（同官网）",
  motionSnappy: "利落",
  motionSoft: "柔弹",
  motionUnfold: "先横后竖",
  motionGrow: "生长",
  motionSmooth: "平滑",
  motionFast: "快速",
  motionBouncy: "Q 弹",
  motionNone: "无动画",
  motionPlay: "播放一次",
  motionCurve: "动画曲线",
  hoverEffect: "悬停效果",
  hoverMotionHint: "鼠标靠近收起的岛时它怎么变：碰到弹一下（默认）碰到岛就变宽一点、轻轻弹一下；靠近就鼓进到岛周围就慢慢鼓起、越近越胖；轻轻鼓起幅度小一半；明显变胖幅度更大、更慢；只往下鼓几乎不变宽；碰到才鼓要碰到岛才变；不变化就不动",
  hoverBounce: "碰到弹一下",
  hoverNear: "靠近就鼓",
  hoverSubtle: "轻轻鼓起",
  hoverBold: "明显变胖",
  hoverDrop: "只往下鼓",
  hoverTouch: "碰到才鼓",
  hoverNone: "不变化",
  hoverTry: "把鼠标移到这里试试",
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
  fuyuTabIcon: "Icon for the Fuyu tab",
  fuyuTabIconHint: "Show the jellyfish instead of the word Fuyu on the first page tab at the top of the open island",
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
  tuckHint: "Hidden hint",
  tuckHintHint: "Leaves a tiny mark at the screen edge while the island is hidden, so you know it is still running; clicks pass through it",
  tuckHintNone: "None",
  tuckHintDot: "Dot",
  tuckHintGlow: "Glow",
  tuckHintColor: "Hint color",
  tuckHintColorContrast: "White",
  tuckHintColorIsland: "Island",
  tuckHintColorCustom: "Custom",
  tuckHintCustomColor: "Custom color",
  tuckHintBreathe: "Breathing hint",
  tuckHintBreatheHint: "The hint slowly fades in and out; it stays steady when the system reduces motion",
  motion: "Open and close",
  motionHint: "Pop (the default) snaps open, the width overshoots and comes back, the height follows a beat later and the content goes from blurred to sharp, and on closing the content vanishes before the island shrinks; Lively shoots out, settles with a slight bounce and brings the content from blurred to sharp; Spring moves as the website's island; Snappy arrives fast; Soft spring barely bounces; Unfold opens sideways, then down; Grow lets the content grow out of the island; Bouncy bounces a few times; Smooth and Fast never overshoot",
  motionPop: "Pop",
  motionLively: "Lively",
  motionSpring: "Spring (as the website)",
  motionSnappy: "Snappy",
  motionSoft: "Soft spring",
  motionUnfold: "Unfold",
  motionGrow: "Grow",
  motionSmooth: "Smooth",
  motionFast: "Fast",
  motionBouncy: "Bouncy",
  motionNone: "None",
  motionPlay: "Play it",
  motionCurve: "Animation curve",
  hoverEffect: "Hover effect",
  hoverMotionHint: "How the collapsed island reacts as the pointer comes near: Bounce on touch (the default) widens a little with a light bounce once the pointer is on the island; Swell nearby starts swelling as the pointer gets close and grows as it nears; Subtle swells half as much; Bold grows more and slower; Drop down grows downward and barely wider; On touch changes only when the pointer is on the island; None keeps it still",
  hoverBounce: "Bounce on touch",
  hoverNear: "Swell nearby",
  hoverSubtle: "Subtle",
  hoverBold: "Bold",
  hoverDrop: "Drop down",
  hoverTouch: "On touch",
  hoverNone: "None",
  hoverTry: "Move the pointer here to try it",
  clickHint: "Opens only when you click the island",
  hoverHint: "Opens under the pointer, closes when it leaves",
  instant: "At once",
  pageKeys: "Page switching keys",
  pageKeysHint: "Number keys, next page and previous page are set under Shortcuts › On the island.",
  pageKeysOpen: "Open",
  tuckIntro: "A tucked island sits against the top of the screen with only an edge showing; it slides out under the pointer or for a new message.",
  alertsTitle: "Shown on the island",
};
