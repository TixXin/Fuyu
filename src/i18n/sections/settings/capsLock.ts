export type CapsLockMode = "flash" | "badge" | "both";

export type SettingsCapsLockText = {
  title: string;
  hint: string;
  hintMac: string;
  mode: string;
  modes: Record<CapsLockMode, string>;
  offAlert: string;
  offAlertHint: string;
  badgeClick: string;
  badgeClickHint: string;
};

export const zhCN: SettingsCapsLockText = {
  title: "大写锁定",
  hint: "按 Caps Lock 时，收起的小岛显示现在是大写还是小写；可以在大写开着时留一个小角标。笔记本自带大写提示的可以不开。",
  hintMac: "按 Caps Lock 时，收起的小岛显示现在是大写还是小写；可以在大写开着时留一个小角标。只用 Caps Lock 切换输入法时不会提示。",
  mode: "提示方式",
  modes: { flash: "只一闪", badge: "只角标", both: "一闪 + 角标" },
  offAlert: "关掉大写时也提示",
  offAlertHint: "灰色的「大写锁定已关闭」",
  badgeClick: "点角标关掉大写",
  badgeClickHint: "角标的位置在「岛屿布局」里摆",
};

export const en: SettingsCapsLockText = {
  title: "Caps Lock",
  hint: "When you press Caps Lock, the collapsed island shows whether it is on or off, and can keep a small badge while it is on. Skip this if your laptop already shows Caps Lock.",
  hintMac: "When you press Caps Lock, the collapsed island shows whether it is on or off, and can keep a small badge while it is on. Switching input sources with Caps Lock shows nothing.",
  mode: "Show",
  modes: { flash: "Flash only", badge: "Badge only", both: "Flash + badge" },
  offAlert: "Also show when turned off",
  offAlertHint: "A grey “Caps Lock Off”",
  badgeClick: "Click the badge to turn it off",
  badgeClickHint: "Place the badge in Island layout",
};
