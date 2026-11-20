export type SettingsCollapsedItemsText = {
  title: string;
  hint: string;
  left: string;
  right: string;
  empty: string;
  moveUp: (name: string) => string;
  moveDown: (name: string) => string;
  toLeft: (name: string) => string;
  toRight: (name: string) => string;
  toPanel: (name: string) => string;
  fromPanel: (name: string) => string;
  inPanel: string;
  noRoom: string;
  show: string;
  showItem: (name: string) => string;
  reset: string;
  center: string;
  centerHint: string;
  previewLabel: string;
  previewHint: string;
  more: (count: number) => string;
  styleOf: (name: string) => string;
  onIsland: string;
  adjust: string;
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

export const zhCN: SettingsCollapsedItemsText = {
  title: "收起条上的项目",
  hint: "摘要文字左右两侧的图标。每项可以调顺序、换到另一侧或隐藏；没有内容时（比如没有新邮件）项目不显示，但位置保留。插件的状态项和用量环也在这里统一排列。消息预览、音量和设备提醒这类临时内容不在这里。「⋯」把项目收进「+N」小面板：不占岛上的位置，停在或点「+N」查看。",
  left: "左侧",
  right: "右侧",
  empty: "这一侧没有项目。",
  moveUp: (name) => `上移：${name}`,
  moveDown: (name) => `下移：${name}`,
  toLeft: (name) => `移到左侧：${name}`,
  toRight: (name) => `移到右侧：${name}`,
  toPanel: (name) => `收进「+N」小面板：${name}`,
  fromPanel: (name) => `放回岛上：${name}`,
  inPanel: "在小面板里",
  noRoom: "刘海旁放不下",
  show: "显示",
  showItem: (name) => `显示：${name}`,
  reset: "恢复默认",
  center: "中间",
  centerHint: "收起条中间的图案和文字，位置固定，只能改样式。",
  previewLabel: "收起条预览",
  previewHint: "点一项，下面清单定位到它",
  more: (count) => `+${count}`,
  styleOf: (name) => `样式：${name}`,
  onIsland: "在岛上",
  adjust: "调整",
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
  hint: "The icons left and right of the summary. Reorder them, move them to the other side or hide them; an item with nothing to show (no new mail, say) stays out of sight but keeps its place. Plugin status items and usage rings are arranged here too. Passing content such as message previews, volume and device alerts is not. The ⋯ button keeps an item behind +N: it takes no room on the island and shows when you hover or click +N.",
  left: "Left",
  right: "Right",
  empty: "Nothing on this side.",
  moveUp: (name) => `Move up: ${name}`,
  moveDown: (name) => `Move down: ${name}`,
  toLeft: (name) => `Move to the left: ${name}`,
  toRight: (name) => `Move to the right: ${name}`,
  toPanel: (name) => `Keep behind +N: ${name}`,
  fromPanel: (name) => `Put back on the island: ${name}`,
  inPanel: "In the +N panel",
  noRoom: "No room beside the notch",
  show: "Show",
  showItem: (name) => `Show: ${name}`,
  reset: "Reset to default",
  center: "Middle",
  centerHint: "The pattern and text in the middle of the bar. Their place is fixed; only their style changes.",
  previewLabel: "Collapsed bar preview",
  previewHint: "Click an item to find it in the list below",
  more: (count) => `+${count}`,
  styleOf: (name) => `Style: ${name}`,
  onIsland: "On the island",
  adjust: "Adjust",
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
