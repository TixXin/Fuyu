import type { OnboardingText } from "../sections/onboarding";
import type { SettingsText } from "../sections/settings/index";
import type { SyncText } from "../sections/sync";
import type { Translations } from "../types";
import { zhCN as agent } from "../sections/agent.ts";
import { zhCN as agentNotice } from "../sections/agentNotice.ts";
import { zhCN as agentNoticeStack } from "../sections/agentNoticeStack.ts";
import { zhCN as archive } from "../sections/archive.ts";
import { zhCN as calendar } from "../sections/calendar.ts";
import { zhCN as claudeUsage } from "../sections/claudeUsage.ts";
import { zhCN as clipboard } from "../sections/clipboard.ts";
import { zhCN as clipboardList } from "../sections/clipboardList.ts";
import { zhCN as clipboardPrivacy } from "../sections/clipboardPrivacy.ts";
import { zhCN as common } from "../sections/common.ts";
import { zhCN as errors } from "../sections/errors.ts";
import { zhCN as fileShelf } from "../sections/fileShelf.ts";
import { zhCN as island } from "../sections/island.ts";
import { zhCN as mail } from "../sections/mail.ts";
import { zhCN as messages } from "../sections/messages.ts";
import { zhCN as music } from "../sections/music.ts";
import { zhCN as notebook } from "../sections/notebook.ts";
import { zhCN as qq } from "../sections/qq.ts";
import { zhCN as screenshot } from "../sections/screenshot.ts";
import { zhCN as sessionRing } from "../sections/sessionRing.ts";
import { zhCN as settingsCalendar } from "../sections/settings/calendar.ts";
import { zhCN as devBuild } from "../sections/settings/devBuild.ts";
import { zhCN as presets } from "../sections/settings/presets.ts";
import { zhCN as project } from "../sections/settings/project.ts";
import { zhCN as timer } from "../sections/timer.ts";
import { zhCN as todo } from "../sections/todo.ts";
import { zhCN as todoIsland } from "../sections/todoIsland.ts";
import { zhCN as translator } from "../sections/translator.ts";
import { zhCN as trayMenu } from "../sections/trayMenu.ts";
import { zhCN as voiceInput } from "../sections/voiceInput.ts";
import { zhCN as wechat } from "../sections/wechat.ts";

const coreSettings = {
  title: "设置",
  devBuild,
  calendar: settingsCalendar,
  project,
  presets,
} as SettingsText;

export const coreZhCN: Translations = {
  localeLabel: "简体中文",
  localeTag: "zh-CN",
  common,
  messages,
  qq,
  wechat,
  mail,
  translator,
  island,
  agent,
  agentNotice,
  agentNoticeStack,
  claudeUsage,
  sessionRing,
  notebook,
  archive,
  todoIsland,
  music,
  calendar,
  todo,
  clipboard,
  clipboardList,
  clipboardPrivacy,
  fileShelf,
  screenshot,
  timer,
  settings: coreSettings,
  onboarding: {} as OnboardingText,
  errors,
  voiceInput,
  trayMenu,
  sync: {} as SyncText,
};
