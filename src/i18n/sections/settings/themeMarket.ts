export type SettingsThemeMarketText = {
  status: (count: number) => string;
  refreshing: string;
  refresh: string;
  loading: string;
  loadFailed: string;
  empty: string;
  official: string;
  by: (author: string) => string;
  apply: string;
  inUse: string;
  save: string;
  saved: string;
  hint: string;
};

export const zhCN: SettingsThemeMarketText = {
  status: (count) => `共 ${count} 个主题`,
  refreshing: "正在刷新主题列表…",
  refresh: "刷新",
  loading: "正在读取主题市场…",
  loadFailed: "读不到主题市场，检查一下网络后点刷新。",
  empty: "主题市场里还没有主题。",
  official: "官方",
  by: (author) => `作者 ${author}`,
  apply: "应用",
  inUse: "使用中",
  save: "保存到我的主题",
  saved: "已保存",
  hint: "主题只改岛屿长什么样（风格、字体、透明度、圆角、颜色），不改尺寸和收起条上的内容。应用后想换回来，到「主题」页点你保存过的主题或「恢复默认主题」。想上架自己的主题，见 TixXin/fuyu-plugins 的说明。",
};

export const en: SettingsThemeMarketText = {
  status: (count) => `${count} ${count === 1 ? "theme" : "themes"}`,
  refreshing: "Refreshing the themes…",
  refresh: "Refresh",
  loading: "Reading the theme market…",
  loadFailed: "Could not read the theme market. Check the network, then refresh.",
  empty: "No themes in the market yet.",
  official: "Official",
  by: (author) => `by ${author}`,
  apply: "Apply",
  inUse: "In use",
  save: "Save to my themes",
  saved: "Saved",
  hint: "A theme changes only what the island looks like (style, font, opacity, corners, colours), not its size or what the collapsed bar shows. To go back, pick a saved theme or Reset theme on the Theme page. To list your own theme, see TixXin/fuyu-plugins.",
};
