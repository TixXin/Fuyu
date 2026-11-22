import type { NotchRimStyle } from "../../../lib/settings/notchRimSettings";
import type { NotchRingStyle } from "../../../lib/settings/notchRingSettings";
import type { NotchColor, NotchWidthLevel } from "../../../lib/settings/notchSettingsModel";

export type SettingsNotchText = {
  title: string;
  hint: string;
  states: { collapsed: string; expanded: string };
  stateLabel: string;
  link: string;
  linkHint: string;
  editing: { collapsed: string; expanded: string; both: string };
  tryLabel: string;
  tryHint: string;
  tries: { camera: string; mic: string; message: string; agent: string; music: string };
  rim: string;
  rimHint: string;
  ring: string;
  ringHint: string;
  plain: string;
  rimStyles: Record<NotchRimStyle, string>;
  rimStyleHints: Record<NotchRimStyle, string>;
  ringStyles: Record<NotchRingStyle, string>;
  ringStyleHints: Record<NotchRingStyle, string>;
  color: string;
  colorHint: string;
  colorHintAurora: string;
  colors: Record<NotchColor, string>;
  lights: string;
  lightsHint: string;
  lightDevice: string;
  lightStatus: string;
  fine: string;
  width: string;
  widths: Record<NotchWidthLevel, string>;
  intensity: string;
  gap: string;
  gapHint: string;
  bottom: string;
  bottomHint: string;
  bottoms: { sides: string; full: string };
  motion: string;
  motionHint: string;
  reset: string;
};

export const zhCN: SettingsNotchText = {
  title: "刘海",
  hint: "只在刘海模式下生效（Mac 的刘海，或岛屿实验台的模拟刘海）。预览和「试一下」只在这里演示，不会让真的岛亮。",
  states: { collapsed: "收起时", expanded: "展开时" },
  stateLabel: "预览和修改哪一边",
  link: "两边一样",
  linkHint: "收起和展开用同一套样式",
  editing: { collapsed: "正在改收起时：", expanded: "正在改展开时：", both: "收起和展开一起改：" },
  tryLabel: "试一下",
  tryHint: "假装发生了这件事，看看会怎么亮",
  tries: { camera: "摄像头", mic: "麦克风", message: "新消息", agent: "Agent 等你", music: "放音乐" },
  rim: "外框",
  rimHint: "岛和面板的外轮廓",
  ring: "内圈",
  ringHint: "沿摄像头刘海画一圈",
  plain: "原样",
  rimStyles: { off: "关", hairline: "发丝", glow: "辉光", comet: "环游", twin: "汇流", aurora: "极光", under: "下沿光" },
  rimStyleHints: {
    off: "和以前一样，岛和刘海连成一整块黑。",
    hairline: "一圈细线，只是让岛有个边界。",
    glow: "带颜色的描边加一层外发光，开动效时慢慢呼吸。",
    comet: "一颗光点从左边弧尖钻出来，绕底边一圈，从右边弧尖钻回去。",
    twin: "两道光从两边弧尖同时流下，在底边正中汇合闪一下。",
    aurora: "几种颜色的渐变描边，沿着边慢慢流动。",
    under: "只亮底边，底下透出一片柔光。",
  },
  ringStyles: { off: "关", hairline: "发丝", glow: "辉光", scan: "扫描", drip: "滴落", progress: "进度", beat: "律动", ticks: "刻度", aurora: "极光" },
  ringStyleHints: {
    off: "和以前一样，看不出刘海在哪。",
    hairline: "沿刘海外沿一圈细线。",
    glow: "带颜色的线，往岛里晕开一层光，开动效时慢慢呼吸。",
    scan: "一个光点沿刘海从左上走到右上，再走回来。",
    drip: "两道光从左右上角流下来，在底边正中汇成一滴。",
    progress: "播放进度沿刘海从左上走到右上；没在播放时是一圈细线。",
    beat: "播放时一下一下地亮；没在播放时是一圈细线。",
    ticks: "一圈细刻度，像镜头的对焦环，开动效时慢慢转。",
    aurora: "几种颜色的渐变沿刘海流动。",
  },
  color: "颜色",
  colorHint: "外框和内圈共用。",
  colorHintAurora: "外框和内圈共用。极光用固定的几种颜色，颜色对它不起作用。",
  colors: { white: "白", accent: "强调色", violet: "紫", pink: "粉", mint: "薄荷", custom: "自定义" },
  lights: "什么时候亮",
  lightsHint: "亮在内圈，样式是「关」也会亮：摄像头绿、麦克风橙，新消息用来源软件的颜色，Agent 等你时橙色闪。外框开着时跟着变色。",
  lightDevice: "摄像头和麦克风",
  lightStatus: "新消息和 Agent",
  fine: "细调",
  width: "粗细",
  widths: { thin: "细", medium: "中", thick: "粗" },
  intensity: "亮度",
  gap: "内圈离刘海",
  gapHint: "线和刘海边缘之间空出多少。",
  bottom: "收起时内圈的底边",
  bottomHint: "收起的岛和刘海一样高，刘海下面没有地方。整圈时收起的岛会往下长几像素。",
  bottoms: { sides: "只画两侧", full: "岛加高画整圈" },
  motion: "动效",
  motionHint: "呼吸、流动。岛隐藏、全屏、贴边收起时停下；系统开了「减少动态效果」时停在静止的样子。",
  reset: "恢复默认",
};

export const en: SettingsNotchText = {
  title: "Notch",
  hint: "Only in notch mode (a Mac notch, or the simulated notch in the island lab). The preview and Try only play here; the real island does not light up.",
  states: { collapsed: "Collapsed", expanded: "Expanded" },
  stateLabel: "Which side to preview and change",
  link: "Same for both",
  linkHint: "Use one look for the collapsed island and the open panel",
  editing: { collapsed: "Collapsed: ", expanded: "Expanded: ", both: "Both: " },
  tryLabel: "Try",
  tryHint: "Pretend this happened and see how it lights up",
  tries: { camera: "Camera", mic: "Mic", message: "Message", agent: "Agent waits", music: "Music" },
  rim: "Border",
  rimHint: "Around the island and the panel",
  ring: "Ring",
  ringHint: "Around the camera notch",
  plain: "None",
  rimStyles: { off: "Off", hairline: "Hairline", glow: "Glow", comet: "Orbit", twin: "Converge", aurora: "Aurora", under: "Underglow" },
  rimStyleHints: {
    off: "As before: the island and the notch are one block of black.",
    hairline: "A thin line that just gives the island an edge.",
    glow: "A coloured line with a glow around it that slowly breathes when motion is on.",
    comet: "A spark comes out of the left curve, runs along the bottom and goes back in at the right.",
    twin: "Two streaks run down from both curves and flash where they meet in the middle.",
    aurora: "A multicoloured line whose colours slowly drift along the edge.",
    under: "Only the bottom edge lights up, with a soft glow below it.",
  },
  ringStyles: { off: "Off", hairline: "Hairline", glow: "Glow", scan: "Scan", drip: "Drip", progress: "Progress", beat: "Beat", ticks: "Ticks", aurora: "Aurora" },
  ringStyleHints: {
    off: "As before: you can't tell where the notch is.",
    hairline: "A thin line along the edge of the notch.",
    glow: "A coloured line with a soft glow into the island, breathing slowly with motion on.",
    scan: "A dot of light runs along the notch from top left to top right and back.",
    drip: "Two lights run down both sides and meet in a drop at the bottom.",
    progress: "Playback progress runs along the notch from top left to top right; a thin line when nothing plays.",
    beat: "Pulses while music plays; a thin line when nothing plays.",
    ticks: "Fine ticks like a lens focus ring, turning slowly with motion on.",
    aurora: "A multi-colour gradient flowing along the notch.",
  },
  color: "Colour",
  colorHint: "Shared by the border and the ring.",
  colorHintAurora: "Shared by the border and the ring. Aurora uses its own colours, so this does not change it.",
  colors: { white: "White", accent: "Accent", violet: "Violet", pink: "Pink", mint: "Mint", custom: "Custom" },
  lights: "Light up for",
  lightsHint: "The ring lights up even when its style is Off: green for the camera, orange for the mic, the app's colour for a message, pulsing orange while an agent waits. The border changes colour when it is on.",
  lightDevice: "Camera and mic",
  lightStatus: "Messages and agents",
  fine: "Fine-tune",
  width: "Thickness",
  widths: { thin: "Thin", medium: "Medium", thick: "Thick" },
  intensity: "Brightness",
  gap: "Ring gap",
  gapHint: "Space between the ring and the edge of the notch.",
  bottom: "Ring bottom when collapsed",
  bottomHint: "The collapsed island is as tall as the notch, so there is no room below it. A full ring makes the collapsed island a few pixels taller.",
  bottoms: { sides: "Sides only", full: "Taller island, full ring" },
  motion: "Motion",
  motionHint: "Breathing and flowing. Stops while the island is hidden, full screen or tucked; holds still when Reduce motion is on.",
  reset: "Reset to default",
};
