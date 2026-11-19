export type SettingsThemeMarketText = {
  title: string;
  more: string;
  moreHint: string;
  browse: string;
  status: (count: number) => string;
  refreshing: string;
  refresh: string;
  loading: string;
  loadFailed: string;
  empty: string;
  searchPlaceholder: string;
  filterAll: string;
  filterOfficial: string;
  filterDual: string;
  noMatches: string;
  official: string;
  dualBadge: string;
  darkTone: string;
  lightTone: string;
  previewDark: string;
  previewLight: string;
  by: (author: string) => string;
  apply: string;
  inUse: string;
  save: string;
  saved: string;
  hint: string;
};

export const zhCN: SettingsThemeMarketText = {
  title: "主题市场",
  more: "更多主题",
  moreHint: "看看别人分享的主题，先预览深浅两色再应用，也能存进「样式预设」。",
  browse: "浏览主题市场",
  status: (count) => `共 ${count} 个主题`,
  refreshing: "正在刷新主题列表…",
  refresh: "刷新",
  loading: "正在读取主题市场…",
  loadFailed: "读不到主题市场，检查一下网络后点刷新。",
  empty: "主题市场里还没有主题。",
  searchPlaceholder: "搜索主题或作者…",
  filterAll: "全部",
  filterOfficial: "官方",
  filterDual: "深浅双色",
  noMatches: "没有匹配的主题。",
  official: "官方",
  dualBadge: "深浅双色",
  darkTone: "深色",
  lightTone: "浅色",
  previewDark: "预览深色版本",
  previewLight: "预览浅色版本",
  by: (author) => `作者 ${author}`,
  apply: "应用",
  inUse: "使用中",
  save: "保存到我的主题",
  saved: "已保存",
  hint: "主题只改岛屿长什么样（风格、字体、透明度、圆角、颜色），不改尺寸和收起条上的内容；标「深浅双色」的主题同时带深色与浅色两套配色，跟随系统时会自动切换。应用后想换回来，到「主题」页点你保存过的主题或「恢复默认主题」。想上架自己的主题，见 TixXin/fuyu-plugins 的说明。",
};

export const en: SettingsThemeMarketText = {
  title: "Theme market",
  more: "More themes",
  moreHint: "See themes others have shared, preview the dark and light versions, then apply one or keep it in Style presets.",
  browse: "Browse the market",
  status: (count) => `${count} ${count === 1 ? "theme" : "themes"}`,
  refreshing: "Refreshing the themes…",
  refresh: "Refresh",
  loading: "Reading the theme market…",
  loadFailed: "Could not read the theme market. Check the network, then refresh.",
  empty: "No themes in the market yet.",
  searchPlaceholder: "Search themes or authors…",
  filterAll: "All",
  filterOfficial: "Official",
  filterDual: "Dark & light",
  noMatches: "No matching themes.",
  official: "Official",
  dualBadge: "Dark & light",
  darkTone: "Dark",
  lightTone: "Light",
  previewDark: "Preview dark variant",
  previewLight: "Preview light variant",
  by: (author) => `by ${author}`,
  apply: "Apply",
  inUse: "In use",
  save: "Save to my themes",
  saved: "Saved",
  hint: "A theme changes only what the island looks like (style, font, opacity, corners, colours), not its size or what the collapsed bar shows; Dark & light themes include both colour sets so following the system switches between them automatically. To go back, pick a saved theme or Reset theme on the Theme page. To list your own theme, see TixXin/fuyu-plugins.",
};
