export type SettingsModulesText = {
  hint: string;
  mail: string;
  offNote: string;
  toOverview: string;
};

export const zhCN: SettingsModulesText = {
  hint: "关闭后，岛上不再显示这个功能的入口，后台也停止运行；已有数据会保留。",
  mail: "启用邮箱",
  offNote: "这个功能关着：岛上不显示它的入口，后台也停止运行，已有数据会保留。在概览里打开后，这里会显示它的设置。",
  toOverview: "去概览 ›",
};

export const en: SettingsModulesText = {
  hint: "When off, the island hides this module and stops its background work. Your data is kept.",
  mail: "Enable mail",
  offNote: "This feature is off: the island hides it and stops its background work, and your data is kept. Turn it on in the overview to see its settings here.",
  toOverview: "Go to overview ›",
};
