export type SettingsResetAppearanceText = {
  /** Theme page: the look. */
  label: string;
  hint: string;
  /** Appearance page: sizes and what the bar shows. */
  layoutLabel: string;
  layoutHint: string;
  confirm: string;
  cancel: string;
};

export const zhCN: SettingsResetAppearanceText = {
  label: "恢复默认主题",
  hint: "风格、颜色和圆角恢复为默认值；尺寸、显示内容和已保存的主题不受影响",
  layoutLabel: "恢复默认外观",
  layoutHint: "尺寸和显示内容恢复为默认值；主题和收起条上的项目不受影响",
  confirm: "确认恢复",
  cancel: "取消",
};

export const en: SettingsResetAppearanceText = {
  label: "Reset theme",
  hint: "Style, colors and corners go back to defaults. Sizes, display and saved themes are kept.",
  layoutLabel: "Reset appearance",
  layoutHint: "Sizes and display go back to defaults. The theme and the collapsed bar items are kept.",
  confirm: "Reset",
  cancel: "Cancel",
};
