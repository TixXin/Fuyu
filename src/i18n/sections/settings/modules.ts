export type SettingsModulesText = {
  hint: string;
  mail: string;
  offNote: string;
  enableNow: string;
  toOverview: string;
};

export const zhCN: SettingsModulesText = {
  hint: "关闭后，岛上不再显示这个功能的入口，后台也停止运行；已有数据会保留。",
  mail: "启用邮箱",
  offNote: "这个功能关着：岛上不显示它的入口，后台也停止运行，已有数据会保留。可以直接开启，或在概览里统一管理。",
  enableNow: "启用此功能",
  toOverview: "去概览 ›",
};

export const en: SettingsModulesText = {
  hint: "When off, the island hides this module and stops its background work. Your data is kept.",
  mail: "Enable mail",
  offNote: "This feature is off: the island hides it and stops its background work, and your data is kept. Turn it on right here, or manage all features in the overview.",
  enableNow: "Turn on",
  toOverview: "Go to overview ›",
};
