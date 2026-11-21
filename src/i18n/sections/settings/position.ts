export type SettingsPositionText = {
  title: string;
  moveHint: string;
  resetRow: string;
  reset: string;
  resetDone: string;
  edge: string;
  edgeOptions: Record<"top" | "bottom" | "left" | "right" | "taskbar", string>;
  taskbarFallback: string;
  sideMusicCover: string;
  sideHeight: string;
  sideHeightOptions: Record<"panel" | "content" | "custom", string>;
  sideHeightCustom: string;
  monitor: string;
  monitorOptions: Record<"primary" | "cursor" | "foreground", string>;
  monitorHint: string;
  menuBar: string;
  menuBarOptions: Record<"notch" | "below", string>;
};

export const zhCN: SettingsPositionText = {
  title: "位置",
  moveHint: "按住收起的岛或展开面板的顶部拖动就能移动它，触控板三指拖动也行。拖到屏幕顶部、底部或左右两侧附近会自动贴齐。",
  resetRow: "回到默认位置",
  reset: "复位",
  resetDone: "已复位",
  edge: "吸附到",
  edgeOptions: { top: "顶边", bottom: "底边", left: "左侧", right: "右侧", taskbar: "任务栏" },
  taskbarFallback: "任务栏现在放不下或藏起来了，岛暂时贴在屏幕底边，有空位后自动回到任务栏。",
  sideMusicCover: "侧边时音乐显示封面",
  sideHeight: "侧边时的高度",
  sideHeightOptions: { panel: "同面板", content: "按内容", custom: "自定义" },
  sideHeightCustom: "侧边高度",
  monitor: "显示在",
  monitorOptions: { primary: "主显示器", cursor: "鼠标所在的显示器", foreground: "前台窗口所在的显示器" },
  monitorHint: "跟随鼠标或前台窗口时，岛屿收起状态下会移到那块屏幕的顶部中间（贴在底边时是底部中间，贴在侧边时留在同一侧的同一高度）；展开时等收起后再移。换屏后拖动过的位置会清掉。",
  menuBar: "菜单栏",
  menuBarOptions: { notch: "压在菜单栏上", below: "放在菜单栏下面" },
};

export const en: SettingsPositionText = {
  title: "Position",
  moveHint: "Drag the collapsed island, or the top of the open panel, to move it; a three-finger trackpad drag works too. Drop it near the top, bottom or either side of the screen to snap flush.",
  resetRow: "Back to the default position",
  reset: "Reset",
  resetDone: "Done",
  edge: "Dock to",
  edgeOptions: { top: "Top edge", bottom: "Bottom edge", left: "Left side", right: "Right side", taskbar: "Taskbar" },
  taskbarFallback: "The taskbar has no room right now or is hidden, so the island sits on the bottom edge until there is space again.",
  sideMusicCover: "Show album art on the side",
  sideHeight: "Height on the side",
  sideHeightOptions: { panel: "Panel", content: "Fit", custom: "Custom" },
  sideHeightCustom: "Side height",
  monitor: "Show on",
  monitorOptions: { primary: "Primary display", cursor: "Display with the pointer", foreground: "Display with the active window" },
  monitorHint: "When following the pointer or the active window, a collapsed island moves to the top middle of that display (the bottom middle when docked to the bottom, the same height on the same side when docked to a side); an open one waits until it collapses. A dragged position is cleared when it moves.",
  menuBar: "Menu bar",
  menuBarOptions: { notch: "Over the menu bar", below: "Below the menu bar" },
};
