import type { NotchRimColor, NotchRimStyle } from "../../../lib/settings/notchRimSettings";

export type SettingsNotchRimText = {
  title: string;
  hint: string;
  island: string;
  islandHint: string;
  panel: string;
  panelHint: string;
  panelSame: string;
  styles: Record<NotchRimStyle, string>;
  styleHints: Record<NotchRimStyle, string>;
  color: string;
  colors: Record<NotchRimColor, string>;
  customColor: string;
  colorAurora: string;
  width: string;
  intensity: string;
  motion: string;
  motionHint: string;
  status: string;
  statusHint: string;
  reset: string;
};

export const zhCN: SettingsNotchRimText = {
  title: "刘海边框",
  hint: "只在刘海模式下生效（Mac 的刘海，或岛屿实验台的模拟刘海）。描边顺着反向弧钻进屏幕顶边，在弧尖淡出。",
  island: "岛屿",
  islandHint: "收起时的岛，包括新消息下拉出来的那一行。",
  panel: "面板",
  panelHint: "展开后的面板。",
  panelSame: "面板同岛屿",
  styles: { off: "关", hairline: "发丝", glow: "辉光", comet: "环游", twin: "汇流", aurora: "极光", under: "下沿光" },
  styleHints: {
    off: "和以前一样，岛和刘海连成一整块黑。",
    hairline: "一圈细线，只是让岛有个边界。",
    glow: "带颜色的描边加一层外发光，开动效时慢慢呼吸。",
    comet: "一颗光点从左边弧尖钻出来，绕底边一圈，从右边弧尖钻回去。",
    twin: "两道光从两边弧尖同时流下，在底边正中汇合闪一下。",
    aurora: "几种颜色的渐变描边，沿着边慢慢流动。",
    under: "只亮底边，底下透出一片柔光。",
  },
  color: "颜色",
  colors: { accent: "强调色", white: "白", violet: "紫", pink: "粉", mint: "薄荷", custom: "自定义" },
  customColor: "自定义颜色",
  colorAurora: "极光用固定的几种颜色，这一项对它不起作用。",
  width: "粗细",
  intensity: "强度",
  motion: "动效",
  motionHint: "呼吸、流动。岛隐藏、全屏、贴边收起时停下；系统开了「减少动态效果」时停在静止的样子。",
  status: "跟随状态变色",
  statusHint: "新消息时用来源软件的颜色，Agent 等你时橙色闪，完成时绿色扫一下。样式是「关」时也会亮这一下。",
  reset: "恢复默认",
};

export const en: SettingsNotchRimText = {
  title: "Notch border",
  hint: "Only in notch mode (a Mac notch, or the simulated notch in the island lab). The line runs up the inverted curves into the top edge of the screen and fades out at their tips.",
  island: "Island",
  islandHint: "The collapsed island, including the row a new message drops down.",
  panel: "Panel",
  panelHint: "The open panel.",
  panelSame: "Panel same as island",
  styles: { off: "Off", hairline: "Hairline", glow: "Glow", comet: "Orbit", twin: "Converge", aurora: "Aurora", under: "Underglow" },
  styleHints: {
    off: "As before: the island and the notch are one block of black.",
    hairline: "A thin line that just gives the island an edge.",
    glow: "A coloured line with a glow around it that slowly breathes when motion is on.",
    comet: "A spark comes out of the left curve, runs along the bottom and goes back in at the right.",
    twin: "Two streaks run down from both curves and flash where they meet in the middle.",
    aurora: "A multicoloured line whose colours slowly drift along the edge.",
    under: "Only the bottom edge lights up, with a soft glow below it.",
  },
  color: "Colour",
  colors: { accent: "Accent", white: "White", violet: "Violet", pink: "Pink", mint: "Mint", custom: "Custom" },
  customColor: "Custom colour",
  colorAurora: "Aurora uses its own fixed colours, so this does not change it.",
  width: "Thickness",
  intensity: "Strength",
  motion: "Motion",
  motionHint: "Breathing and flowing. Stops while the island is hidden, a full-screen app is in front or the island is tucked away; with Reduce motion on, it stays still.",
  status: "Change colour with status",
  statusHint: "A new message lights it in that app's colour, an agent waiting for you flashes orange and a finished one sweeps green. This lights up even when the style is Off.",
  reset: "Reset to default",
};
