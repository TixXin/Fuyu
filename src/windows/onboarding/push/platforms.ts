import type { CcConnectSetupPlatform } from "../../../features/cc-connect/api";
import type { OnboardingPushPlatform } from "../../../i18n/sections/onboarding-push";

export type PushPlatform = CcConnectSetupPlatform;

export type PushPlatformInfo = {
  id: OnboardingPushPlatform;
  usable: boolean;
  recommended: boolean;
  create: string;
  guide: string;
};

export const PUSH_PLATFORMS: readonly PushPlatformInfo[] = [
  { id: "feishu", usable: true, recommended: true, create: "https://open.feishu.cn/app", guide: "https://open.feishu.cn/document/home/index" },
  { id: "telegram", usable: true, recommended: false, create: "https://t.me/BotFather", guide: "https://core.telegram.org/bots/tutorial" },
  { id: "discord", usable: true, recommended: false, create: "https://discord.com/developers/applications", guide: "https://discord.com/developers/docs/quick-start/getting-started" },
  { id: "weixin", usable: false, recommended: false, create: "https://github.com/chenhg5/cc-connect", guide: "https://github.com/chenhg5/cc-connect#readme" },
];

export function isPushPlatform(id: OnboardingPushPlatform): id is PushPlatform {
  return PUSH_PLATFORMS.some((platform) => platform.id === id && platform.usable);
}
