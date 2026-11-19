import type { OnboardingText } from "../sections/onboarding";
import type { SettingsText } from "../sections/settings/index";
import type { SyncText } from "../sections/sync";
import type { Translations } from "../types";
import { en as agent } from "../sections/agent.ts";
import { en as agentNotice } from "../sections/agentNotice.ts";
import { en as archive } from "../sections/archive.ts";
import { en as calendar } from "../sections/calendar.ts";
import { en as claudeUsage } from "../sections/claudeUsage.ts";
import { en as clipboard } from "../sections/clipboard.ts";
import { en as clipboardList } from "../sections/clipboardList.ts";
import { en as clipboardPrivacy } from "../sections/clipboardPrivacy.ts";
import { en as common } from "../sections/common.ts";
import { en as errors } from "../sections/errors.ts";
import { en as fileShelf } from "../sections/fileShelf.ts";
import { en as island } from "../sections/island.ts";
import { en as mail } from "../sections/mail.ts";
import { en as messages } from "../sections/messages.ts";
import { en as music } from "../sections/music.ts";
import { en as notebook } from "../sections/notebook.ts";
import { en as qq } from "../sections/qq.ts";
import { en as screenshot } from "../sections/screenshot.ts";
import { en as sessionRing } from "../sections/sessionRing.ts";
import { en as settingsCalendar } from "../sections/settings/calendar.ts";
import { en as devBuild } from "../sections/settings/devBuild.ts";
import { en as presets } from "../sections/settings/presets.ts";
import { en as project } from "../sections/settings/project.ts";
import { en as timer } from "../sections/timer.ts";
import { en as todo } from "../sections/todo.ts";
import { en as todoIsland } from "../sections/todoIsland.ts";
import { en as translator } from "../sections/translator.ts";
import { en as trayMenu } from "../sections/trayMenu.ts";
import { en as voiceInput } from "../sections/voiceInput.ts";
import { en as wechat } from "../sections/wechat.ts";

const coreSettings = {
  title: "Settings",
  devBuild,
  calendar: settingsCalendar,
  project,
  presets,
} as SettingsText;

export const coreEn: Translations = {
  localeLabel: "English",
  localeTag: "en",
  common,
  messages,
  qq,
  wechat,
  mail,
  translator,
  island,
  agent,
  agentNotice,
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
