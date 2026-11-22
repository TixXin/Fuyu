import type { IslandHover, IslandMotion, TuckHintStyle, TuckStyle, WidgetEntrance } from "../../../lib/settings/types";

export type TuckHold = "todo" | "agent" | "music" | "messages";

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
  holdMusic: string;
  holdMusicElsewhere: string;
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
  bounce: string;
  bounceHint: string;
  bounceSubtle: string;
  bounceRegular: string;
  bounceBouncy: string;
  widgetEntrance: string;
  widgetEntranceHint: string;
  widgetEntrances: Record<WidgetEntrance, string>;
  widgetData: string;
  widgetDataHint: string;
  hoverEffect: string;
  hoverMotionHint: string;
  hoverBounce: string;
  hoverNear: string;
  hoverSubtle: string;
  hoverBold: string;
  hoverDrop: string;
  hoverTouch: string;
  hoverNone: string;
  clickHint: string;
  hoverHint: string;
  instant: string;
  pageKeys: string;
  pageKeysHint: string;
  pageKeysOpen: string;
  alertsTitle: string;
  tuckLookTitle: string;
  tuckWhenTitle: string;
  tuckPreviewLabel: string;
  tuckTry: string;
  tuckTryHint: string;
  tuckStyleHints: Record<TuckStyle, string>;
  tuckHintStyleHints: Record<TuckHintStyle, string>;
  tuckHintColorHint: string;
  holds: string;
  holdsHint: string;
  holdChips: Record<TuckHold, string>;
  motionHints: Record<IslandMotion, string>;
  hoverHints: Record<IslandHover, string>;
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
  holdMusic: "音乐播放中不收起",
  holdMusicElsewhere: "播放音乐时岛一直留在屏幕上。和「行为 → 贴边隐藏」里的是同一个开关，打开了自动收起才起作用。",
  revealOnMessage: "有新消息时露出",
  tuckedHover: "鼠标移到隐藏的岛上",
  tuckedHoverReveal: "只露出岛屿",
  tuckedHoverExpand: "展开面板",
  tuckStyle: "露出样式",
  tuckStyleHint: "顶边和底边贴边隐藏后露出多少",
  tuckStyleEdge: "标准露边",
  tuckStyleLine: "极简细线",
  tuckStyleHidden: "贴边隐身",
  tuckHint: "隐身记号",
  tuckHintHint: "隐身提示：贴边隐身时在屏幕边缘留个小记号，表示岛还在运行，不挡鼠标",
  tuckHintNone: "无",
  tuckHintDot: "小圆点",
  tuckHintGlow: "光晕",
  tuckHintColor: "记号颜色",
  tuckHintColorContrast: "白色描边",
  tuckHintColorIsland: "跟随岛色",
  tuckHintColorCustom: "自选",
  tuckHintCustomColor: "自选颜色",
  tuckHintBreathe: "记号呼吸",
  tuckHintBreatheHint: "提示呼吸：记号慢慢明暗变化；系统开了减少动画时一直常亮",
  motion: "开合动画",
  motionHint: "鼠标移到格子上就演一次，点一下选用",
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
  bounce: "弹开的回弹",
  bounceHint: "弹动幅度：到位时冲过头多少；悬停效果「碰到弹一下」也跟着变",
  bounceSubtle: "轻微",
  bounceRegular: "常规",
  bounceBouncy: "弹动",
  widgetEntrance: "小组件出场动效",
  widgetEntranceHint: "面板展开时 Fuyu 页的小组件怎么出现；轮播每次换一种，下次展开时生效",
  widgetEntrances: {
    shuffle: "轮播",
    fade: "整体淡入",
    spread: "跟着面板撑开",
    curtain: "幕布",
    wave: "光波",
    ripple: "涟漪",
    skeleton: "骨架扫光",
    trace: "描边点亮",
    glow: "逐个通电",
    drop: "落位",
    bubble: "水母吐泡泡",
    focus: "对焦",
    flip: "翻牌",
  },
  widgetData: "数据动效",
  widgetDataHint: "小组件出现时，圆环扫出来、数字跳到位、进度条灌满、格子一波波亮起",
  hoverEffect: "悬停效果",
  hoverMotionHint: "鼠标靠近收起的岛时它怎么变；移到格子上就演一次",
  hoverBounce: "碰到弹一下",
  hoverNear: "靠近就鼓",
  hoverSubtle: "轻轻鼓起",
  hoverBold: "明显变胖",
  hoverDrop: "只往下鼓",
  hoverTouch: "碰到才鼓",
  hoverNone: "不变化",
  clickHint: "点一下小岛才展开",
  hoverHint: "鼠标移上去就展开，移开收起",
  instant: "立即",
  pageKeys: "页面切换快捷键",
  pageKeysHint: "数字键切页、上一页和下一页，在「快捷键 › 岛上」里改。",
  pageKeysOpen: "去设置",
  alertsTitle: "在小岛上提示",
  tuckLookTitle: "隐藏后的样子",
  tuckWhenTitle: "什么时候收起",
  tuckPreviewLabel: "屏幕顶边，按下面的设置画",
  tuckTry: "试一下",
  tuckTryHint: "演鼠标碰到顶边、岛滑出来再收回去，只在这里演",
  tuckStyleHints: {
    edge: "露出 10 像素的一条边，鼠标碰到就滑出来",
    line: "只露一条 4 像素的细线",
    hidden: "完全不露；鼠标推到屏幕边缘照常唤醒",
  },
  tuckHintStyleHints: {
    none: "什么都不留",
    dot: "屏幕边下方一个小圆点",
    glow: "贴着屏幕边的一道短光",
  },
  tuckHintColorHint: "提示颜色：白色描边、跟随岛色，或点彩色那格自选颜色",
  holds: "这些时候不收起",
  holdsHint: "有正在进行的待办、Agent 在等你、音乐播放中、有未读消息时，岛一直留在屏幕上；音乐这项和「音乐」页里的是同一个开关",
  holdChips: { todo: "待办", agent: "Agent", music: "音乐", messages: "消息" },
  motionHints: {
    pop: "默认。一下子张开，宽和高都冲过头一点再回来，收起时不回弹",
    lively: "快速冲出去、微微回一下，内容由模糊变清楚",
    spring: "和官网上的岛一样的弹簧",
    snappy: "很快到位，几乎不晃",
    soft: "柔和的弹簧，几乎不弹",
    unfold: "先横着拉开，再往下落",
    grow: "内容从岛里长出来",
    smooth: "平滑展开，不回弹",
    fast: "最快到位，不回弹",
    bouncy: "到位后弹几下",
    none: "直接切换，没有动画",
  },
  hoverHints: {
    bounce: "默认。碰到岛就变宽一点、轻轻弹一下",
    near: "鼠标靠近就慢慢鼓起，越近越胖",
    subtle: "和「靠近就鼓」一样，幅度小一半",
    bold: "鼓得更大、更慢",
    drop: "只往下鼓，几乎不变宽",
    touch: "碰到岛才鼓起来",
    none: "不变化",
  },
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
  holdMusic: "Stay out while music plays",
  holdMusicElsewhere: "While music plays, the island stays on screen. It is the same switch as in Behavior → Tuck to edge, and works only when auto tuck is on.",
  revealOnMessage: "Slide out for new messages",
  tuckedHover: "Pointer on a tucked island",
  tuckedHoverReveal: "Slides it out",
  tuckedHoverExpand: "Opens the panel",
  tuckStyle: "Tucked edge",
  tuckStyleHint: "How much shows when tucked at the top or bottom edge",
  tuckStyleEdge: "Standard edge",
  tuckStyleLine: "Thin line",
  tuckStyleHidden: "Hidden",
  tuckHint: "Hidden mark",
  tuckHintHint: "Hidden hint: leaves a tiny mark at the screen edge so you know the island is still running; clicks pass through it",
  tuckHintNone: "None",
  tuckHintDot: "Dot",
  tuckHintGlow: "Glow",
  tuckHintColor: "Mark color",
  tuckHintColorContrast: "White",
  tuckHintColorIsland: "Island",
  tuckHintColorCustom: "Custom",
  tuckHintCustomColor: "Custom color",
  tuckHintBreathe: "Breathing mark",
  tuckHintBreatheHint: "Breathing hint: the mark slowly fades in and out; it stays steady when the system reduces motion",
  motion: "Open and close",
  motionHint: "Point at a tile to play it once, click to use it",
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
  bounce: "Pop overshoot",
  bounceHint: "Bounce strength: how far it swings past the end; also sets the Bounce on touch hover effect",
  bounceSubtle: "Subtle",
  bounceRegular: "Regular",
  bounceBouncy: "Bouncy",
  widgetEntrance: "Widget entrance",
  widgetEntranceHint: "How the widgets on the Fuyu page appear when the panel opens; Shuffle picks a new one each time. Applies the next time it opens",
  widgetEntrances: {
    shuffle: "Shuffle",
    fade: "Fade in",
    spread: "Spread with the panel",
    curtain: "Curtain",
    wave: "Light wave",
    ripple: "Ripple",
    skeleton: "Skeleton sweep",
    trace: "Outline trace",
    glow: "Switch on",
    drop: "Drop in",
    bubble: "Jellyfish bubbles",
    focus: "Focus pull",
    flip: "Flip",
  },
  widgetData: "Data motion",
  widgetDataHint: "As widgets appear, rings sweep in, numbers count up, bars fill and grids light up in a wave",
  hoverEffect: "Hover effect",
  hoverMotionHint: "How the collapsed island reacts as the pointer comes near; point at a tile to play it",
  hoverBounce: "Bounce on touch",
  hoverNear: "Swell nearby",
  hoverSubtle: "Subtle",
  hoverBold: "Bold",
  hoverDrop: "Drop down",
  hoverTouch: "On touch",
  hoverNone: "None",
  clickHint: "Opens only when you click the island",
  hoverHint: "Opens under the pointer, closes when it leaves",
  instant: "At once",
  pageKeys: "Page switching keys",
  pageKeysHint: "Number keys, next page and previous page are set under Shortcuts › On the island.",
  pageKeysOpen: "Open",
  alertsTitle: "Shown on the island",
  tuckLookTitle: "When tucked",
  tuckWhenTitle: "When to tuck",
  tuckPreviewLabel: "The top of the screen, drawn with the settings below",
  tuckTry: "Try it",
  tuckTryHint: "Plays the pointer touching the top edge and the island sliding out and back, only here",
  tuckStyleHints: {
    edge: "A 10 px edge shows and slides out under the pointer",
    line: "Only a 4 px line shows",
    hidden: "Nothing shows; pushing the pointer to the screen edge still wakes it",
  },
  tuckHintStyleHints: {
    none: "Leaves nothing",
    dot: "A small dot just below the screen edge",
    glow: "A short glow along the screen edge",
  },
  tuckHintColorHint: "Hint color: white, the island's color, or pick your own with the rainbow swatch",
  holds: "Stay out while",
  holdsHint: "While a todo is in progress, an agent waits for you, music plays or messages are unread, the island stays on screen; Music is the same switch as on the Music page",
  holdChips: { todo: "Todo", agent: "Agent", music: "Music", messages: "Messages" },
  motionHints: {
    pop: "The default. Springs open, overshoots a little and comes back; closes without a bounce",
    lively: "Shoots out with a slight bounce; the content sharpens from a blur",
    spring: "The same spring as the island on the website",
    snappy: "Gets there fast with barely a wobble",
    soft: "A gentle spring that barely bounces",
    unfold: "Opens sideways first, then down",
    grow: "The content grows out of the island",
    smooth: "Opens smoothly without overshooting",
    fast: "Gets there quickest without overshooting",
    bouncy: "Bounces a few times as it arrives",
    none: "Switches at once, no animation",
  },
  hoverHints: {
    bounce: "The default. Widens a little with a light bounce once the pointer is on it",
    near: "Swells as the pointer gets close, more the nearer it is",
    subtle: "Like Swell nearby, half as much",
    bold: "Swells more and slower",
    drop: "Grows downward and barely wider",
    touch: "Swells only once the pointer is on it",
    none: "Stays still",
  },
};
