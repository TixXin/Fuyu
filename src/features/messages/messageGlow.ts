import type { PreviewSource } from "./messagePreview.ts";

const GLOW_COLORS: Record<PreviewSource, string> = {
  qq: "#12b7f5",
  wechat: "#07c160",
  qqMail: "#ffb340",
  telegram: "#2aabee",
  discord: "#5865f2",
  whatsapp: "#25d366",
  tim: "#12b7f5",
  feishu: "#3370ff",
  dingtalk: "#1677ff",
  wecom: "#2b7cff",
  plugin: "#64d2ff",
};

export function messageGlowColor(source: PreviewSource): string {
  return GLOW_COLORS[source] ?? GLOW_COLORS.plugin;
}
