export type SettingsCollapsedItemsText = {
  title: string;
  hint: string;
  reset: string;
  previewLabel: string;
  previewHint: string;
  more: (count: number) => string;
  styleOf: (name: string) => string;
  onIsland: string;
  adjust: string;
  lanes: SettingsCollapsedLanesText;
  place: {
    left: (position: number) => string;
    right: (position: number) => string;
    panel: string;
    hidden: string;
    text: string;
    center: string;
    absent: string;
  };
  item: {
    center: string;
    todoCount: string;
    statusLight: string;
    mail: string;
    update: string;
    deviceUse: string;
    shelf: string;
    music: string;
    sessionCount: string;
    usage: (agent: string) => string;
  };
};

export type LaneName = "left" | "center" | "right" | "shelf" | "off";

export type SettingsCollapsedLanesText = {
  keys: string;
  onBar: string;
  name: Record<LaneName, string>;
  laneHint: Record<Exclude<LaneName, "off">, string>;
  notchHint: Record<"left" | "center" | "right", string>;
  notchCaption: string;
  offDrop: string;
  allOn: string;
  dropHere: string;
  denyCenter: string;
  fold: string;
  spilled: string;
  at: (lane: string, position: number) => string;
  chip: (name: string, lane: string) => string;
  remove: (name: string) => string;
  removeTitle: string;
  restore: (name: string) => string;
  restoreTitle: (lane: string) => string;
  placeIn: (lane: string) => string;
  style: string;
  takeOff: string;
  removed: (name: string) => string;
  placed: (name: string, where: string) => string;
  restored: (name: string, lane: string) => string;
  picked: (name: string, where: string) => string;
  unmoved: string;
  cancelled: string;
  undo: string;
  undone: string;
  resetDone: string;
  styles: string;
  notOn: string;
};

export const zhCN: SettingsCollapsedItemsText = {
  title: "收起条上的项目",
  hint: "摘要文字左右两侧的图标。没有内容时（比如没有新邮件）项目不显示，但位置保留。插件的状态项和用量环也在这里统一排列；消息预览、音量和设备提醒这类临时内容不在这里。放进「小面板」的项目收在「+N」里：不占岛上的位置，停在或点「+N」查看。",
  reset: "恢复默认",
  previewLabel: "收起条预览",
  previewHint: "点一项，下面定位到它；也可以直接拖",
  more: (count) => `+${count}`,
  styleOf: (name) => `样式：${name}`,
  onIsland: "在岛上",
  adjust: "调整",
  lanes: {
    keys: "拖动换位置 · 空格拿起后用方向键 · 右键有菜单",
    onBar: "在收起条上",
    name: { left: "左侧", center: "中间", right: "右侧", shelf: "小面板", off: "可以放上去" },
    laneHint: { left: "摘要左边", center: "位置固定，只能改样式", right: "摘要右边", shelf: "一直收在「+N」里，点开才看到，不占条上的位置" },
    offDrop: "松手就拿下来",
    allOn: "都放上去了",
    dropHere: "拖到这里",
    notchHint: { left: "刘海左边", center: "排在刘海右边最前", right: "刘海右边" },
    notchCaption: "现在是刘海模式：中间被摄像头挡住，不显示文字",
    denyCenter: "中间只放中心图案和剩余待办数",
    fold: "放不下，后面的收进 +N",
    spilled: "刘海旁放不下，收进了 +N",
    at: (lane, position) => `${lane}第 ${position} 个`,
    chip: (name, lane) => `${name}，${lane}`,
    remove: (name) => `把${name}拿下来`,
    removeTitle: "拿下来",
    restore: (name) => `把${name}放上去`,
    restoreTitle: (lane) => `放回${lane}`,
    placeIn: (lane) => `放在${lane}`,
    style: "样式…",
    takeOff: "拿下来",
    removed: (name) => `已拿下「${name}」`,
    placed: (name, where) => `「${name}」放在${where}`,
    restored: (name, lane) => `「${name}」放回${lane}`,
    picked: (name, where) => `已拿起「${name}」，现在在${where}。方向键移动，回车放下，Esc 取消`,
    unmoved: "已放下，位置没变",
    cancelled: "已取消，回到原位",
    undo: "撤销",
    undone: "已撤销",
    resetDone: "已恢复默认排列",
    styles: "样式",
    notOn: "没放上去",
  },
  place: {
    left: (position) => `左侧第 ${position} 个`,
    right: (position) => `右侧第 ${position} 个`,
    panel: "在「+N」小面板里",
    hidden: "不显示",
    text: "文字位",
    center: "中间",
    absent: "没在岛上",
  },
  item: {
    center: "中心图案",
    todoCount: "剩余待办数",
    statusLight: "浮屿水母",
    mail: "新邮件提醒",
    update: "更新提醒",
    deviceUse: "摄像头 / 麦克风",
    shelf: "文件中转数量",
    music: "音乐",
    sessionCount: "会话数 / 会话环",
    usage: (agent) => `用量环 · ${agent}`,
  },
};

export const en: SettingsCollapsedItemsText = {
  title: "Items on the collapsed bar",
  hint: "The icons left and right of the summary. An item with nothing to show (no new mail, say) stays out of sight but keeps its place. Plugin status items and usage rings are arranged here too; passing content such as message previews, volume and device alerts is not. Items in the +N panel take no room on the island and show when you hover or click +N.",
  reset: "Reset to default",
  previewLabel: "Collapsed bar preview",
  previewHint: "Click an item to find it below, or drag it",
  more: (count) => `+${count}`,
  styleOf: (name) => `Style: ${name}`,
  onIsland: "On the island",
  adjust: "Adjust",
  lanes: {
    keys: "Drag to move · Space to pick up, then arrow keys · Right-click for a menu",
    onBar: "On the collapsed bar",
    name: { left: "Left", center: "Middle", right: "Right", shelf: "+N panel", off: "Not on the bar" },
    laneHint: { left: "Left of the summary", center: "Fixed in place; only the style changes", right: "Right of the summary", shelf: "Always kept behind +N; open it to see them, they take no room on the bar" },
    offDrop: "Drop to take it off",
    allOn: "Everything is on the bar",
    dropHere: "Drag here",
    notchHint: { left: "Left of the notch", center: "First on the right of the notch", right: "Right of the notch" },
    notchCaption: "Notch mode: the camera covers the middle and no text shows",
    denyCenter: "Only the center pattern and the todo count go in the middle",
    fold: "No room from here on, these go behind +N",
    spilled: "No room beside the notch, kept behind +N",
    at: (lane, position) => `${lane}, no. ${position}`,
    chip: (name, lane) => `${name}, ${lane}`,
    remove: (name) => `Take ${name} off`,
    removeTitle: "Take off",
    restore: (name) => `Put ${name} on the bar`,
    restoreTitle: (lane) => `Back to ${lane}`,
    placeIn: (lane) => `Put in ${lane}`,
    style: "Style…",
    takeOff: "Take off",
    removed: (name) => `Took “${name}” off`,
    placed: (name, where) => `“${name}” is now ${where}`,
    restored: (name, lane) => `“${name}” is back in ${lane}`,
    picked: (name, where) => `Picked up “${name}”, now ${where}. Arrow keys move it, Enter drops it, Esc cancels`,
    unmoved: "Dropped, nothing moved",
    cancelled: "Cancelled, back where it was",
    undo: "Undo",
    undone: "Undone",
    resetDone: "Back to the default layout",
    styles: "Style",
    notOn: "Not on the bar",
  },
  place: {
    left: (position) => `left, no. ${position}`,
    right: (position) => `right, no. ${position}`,
    panel: "behind +N",
    hidden: "hidden",
    text: "text slot",
    center: "middle",
    absent: "not on the island",
  },
  item: {
    center: "Center pattern",
    todoCount: "Todos left",
    statusLight: "Fuyu jellyfish",
    mail: "New mail",
    update: "Update available",
    deviceUse: "Camera / microphone",
    shelf: "File shelf count",
    music: "Music",
    sessionCount: "Session count / ring",
    usage: (agent) => `Usage ring · ${agent}`,
  },
};
