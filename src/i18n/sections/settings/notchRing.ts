import type { NotchRingBottom, NotchRingColor, NotchRingStyle } from "../../../lib/settings/notchRingSettings";

export type SettingsNotchRingText = {
  title: string;
  hint: string;
  island: string;
  islandHint: string;
  panel: string;
  panelHint: string;
  panelSame: string;
  styles: Record<NotchRingStyle, string>;
  styleHints: Record<NotchRingStyle, string>;
  color: string;
  colors: Record<NotchRingColor, string>;
  customColor: string;
  colorAurora: string;
  width: string;
  gap: string;
  gapHint: string;
  intensity: string;
  motion: string;
  motionHint: string;
  bottom: string;
  bottomHint: string;
  bottoms: Record<NotchRingBottom, string>;
  device: string;
  deviceHint: string;
  status: string;
  statusHint: string;
  reset: string;
};

export const zhCN: SettingsNotchRingText = {
  title: "摄像头刘海一圈",
  hint: "只在刘海模式下生效（Mac 的刘海，或岛屿实验台的模拟刘海）。在岛里面沿摄像头刘海画一圈，光只往岛里晕，不画到桌面上。",
  island: "收起的岛",
  islandHint: "收起时围着刘海画。",
  panel: "展开的面板",
  panelHint: "展开后面板顶上围着刘海画。",
  panelSame: "面板同收起的岛",
  styles: { off: "关", hairline: "发丝", glow: "辉光", scan: "扫描", drip: "滴落", progress: "进度", beat: "律动", ticks: "刻度", aurora: "极光" },
  styleHints: {
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
  colors: { white: "白", accent: "强调色", violet: "紫", pink: "粉", mint: "薄荷", custom: "自定义" },
  customColor: "自定义颜色",
  colorAurora: "极光用固定的几种颜色，这一项对它不起作用。",
  width: "粗细",
  gap: "离刘海",
  gapHint: "线和刘海边缘之间空出多少。",
  intensity: "强度",
  motion: "动效",
  motionHint: "呼吸、流动。岛隐藏、全屏、贴边收起时停下；系统开了「减少动态效果」时停在静止的样子。",
  bottom: "收起时的底边",
  bottomHint: "收起的岛和刘海一样高，底边画不下。",
  bottoms: { sides: "只画两侧", full: "岛加高画整圈" },
  device: "摄像头、麦克风开着时亮",
  deviceHint: "摄像头开着亮绿、麦克风开着亮橙，和系统隐私灯同色。样式是「关」时也亮。",
  status: "新消息、Agent 等你时亮",
  statusHint: "新消息用来源软件的颜色，Agent 等你时橙色闪，完成时绿色亮一下。样式是「关」时也亮。",
  reset: "恢复默认",
};

export const en: SettingsNotchRingText = {
  title: "Ring around the camera notch",
  hint: "Only in notch mode (a Mac notch, or the simulated notch in the island lab). Draws a ring inside the island along the camera notch; the light stays inside the island and never spills onto the desktop.",
  island: "Collapsed island",
  islandHint: "Around the notch while collapsed.",
  panel: "Expanded panel",
  panelHint: "Around the notch at the top of the panel.",
  panelSame: "Panel matches the collapsed island",
  styles: { off: "Off", hairline: "Hairline", glow: "Glow", scan: "Scan", drip: "Drip", progress: "Progress", beat: "Beat", ticks: "Ticks", aurora: "Aurora" },
  styleHints: {
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
  colors: { white: "White", accent: "Accent", violet: "Violet", pink: "Pink", mint: "Mint", custom: "Custom" },
  customColor: "Custom colour",
  colorAurora: "Aurora uses its own colours; this has no effect on it.",
  width: "Width",
  gap: "Gap",
  gapHint: "Space between the line and the edge of the notch.",
  intensity: "Intensity",
  motion: "Motion",
  motionHint: "Breathing and flowing. Stops while the island is hidden, full screen or tucked; holds still when Reduce motion is on.",
  bottom: "Bottom when collapsed",
  bottomHint: "The collapsed island is as tall as the notch, so there is no room below it.",
  bottoms: { sides: "Sides only", full: "Grow the island, full ring" },
  device: "Light up while the camera or mic is on",
  deviceHint: "Green for the camera, orange for the microphone, like the system privacy dots. Works even when the style is Off.",
  status: "Light up for new messages and waiting agents",
  statusHint: "The app's colour for a new message, pulsing orange while an agent waits, a green flash when it finishes. Works even when the style is Off.",
  reset: "Reset to default",
};
