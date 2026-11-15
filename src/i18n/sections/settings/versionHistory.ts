export type SettingsVersionHistoryText = {
  title: string;
  current: string;
  beta: string;
  betaCount: (count: number) => string;
  stableChip: string;
  betaChip: (number: number) => string;
  versionsLabel: (base: string) => string;
  loading: string;
  failed: string;
  empty: string;
  showOlder: (count: number) => string;
  showLess: string;
  footnote: string;
};

export const zhCN: SettingsVersionHistoryText = {
  title: "更新日志",
  current: "当前",
  beta: "测试版",
  betaCount: (count) => `含 ${count} 个测试版`,
  stableChip: "正式版",
  betaChip: (number) => `测试版 ${number}`,
  versionsLabel: (base) => `v${base} 的各个版本`,
  loading: "正在读取说明…",
  failed: "这一版的说明读不出来。",
  empty: "这一版没有写更新说明。",
  showOlder: (count) => `显示更早的 ${count} 个版本`,
  showLess: "只看最近的",
  footnote: "说明随应用一起安装，不联网也能看。比当前更新的版本在上面的「版本」里检查和查看。",
};

export const en: SettingsVersionHistoryText = {
  title: "Changelog",
  current: "Current",
  beta: "Beta",
  betaCount: (count) => (count === 1 ? "1 beta" : `${count} betas`),
  stableChip: "Release",
  betaChip: (number) => `Beta ${number}`,
  versionsLabel: (base) => `Builds of v${base}`,
  loading: "Loading notes…",
  failed: "Couldn't read the notes for this version.",
  empty: "This version has no release notes.",
  showOlder: (count) => (count === 1 ? "Show 1 older version" : `Show ${count} older versions`),
  showLess: "Show recent only",
  footnote: "Notes come with the app, so they open offline too. Newer versions show up under Version above.",
};
