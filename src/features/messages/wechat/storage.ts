export const ENABLED_KEY = "fuyu-wechat-reminders-enabled";

export const EXPOSE_UI_KEY = "fuyu-wechat-expose-ui";

export function isWeChatExposeUiEnabled() {
  return window.localStorage.getItem(EXPOSE_UI_KEY) === "true";
}

export function saveWeChatExposeUiEnabled(enabled: boolean) {
  window.localStorage.setItem(EXPOSE_UI_KEY, String(enabled));
}

export const HIDE_TASKBAR_BUTTON_KEY = "fuyu-wechat-hide-taskbar-button";

export function isWeChatHideTaskbarButtonEnabled() {
  return window.localStorage.getItem(HIDE_TASKBAR_BUTTON_KEY) !== "false";
}

export function saveWeChatHideTaskbarButtonEnabled(enabled: boolean) {
  window.localStorage.setItem(HIDE_TASKBAR_BUTTON_KEY, String(enabled));
}

export function isWeChatRemindersEnabled() {
  return window.localStorage.getItem(ENABLED_KEY) !== "false";
}

export function saveWeChatRemindersEnabled(enabled: boolean) {
  window.localStorage.setItem(ENABLED_KEY, String(enabled));
}
