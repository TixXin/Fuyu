import { useEffect } from "react";
import { setBuiltinConfig } from "../../plugin-kernel/builtinSwitches";
import { useBuiltinConfig, useBuiltinPlugins } from "../../plugin-kernel/useBuiltinPlugins";
import { isQQAutoClearEnabled, isQQNotificationsEnabled } from "../qq-notifications/storage";
import { isWeChatAutoClearEnabled, isWeChatRemindersEnabled } from "../wechat/storage";
import { MESSAGE_LAYOUT_CONFIG_KEY, normalizeMessageLayout, type MessageLayout } from "../feed/messageLayout";
import { OWNER } from "./owner.ts";
import {
  imSourceEnabled,
  mergedAutoClear,
  MESSAGE_SOURCES,
  migrateSources,
  sourceSwitch,
  type ImSourceId,
  type MessageSource,
} from "./sourceSwitches.ts";

export async function setSourceEnabled(source: MessageSource, on: boolean): Promise<void> {
  await setBuiltinConfig(OWNER, source, on);
}

export function useMessageAutoClear(): boolean {
  const config = useBuiltinConfig(OWNER);
  return mergedAutoClear(config, { qq: isQQAutoClearEnabled(), wechat: isWeChatAutoClearEnabled() });
}

export async function setMessageAutoClearEnabled(on: boolean): Promise<void> {
  await setBuiltinConfig(OWNER, "autoClear", on);
}

export function useImSourceEnabled(source: ImSourceId): boolean {
  const config = useBuiltinConfig(OWNER);
  return imSourceEnabled(config, source);
}

export function useMailEnabled(fallback = true): boolean {
  const config = useBuiltinConfig(OWNER);
  return sourceSwitch(config, "mail") ?? fallback;
}

export function useMessageOtpCopyEnabled(): boolean {
  const config = useBuiltinConfig(OWNER);
  return sourceSwitch(config, "otpCopy") ?? true;
}

export async function setMessageOtpCopyEnabled(on: boolean): Promise<void> {
  await setBuiltinConfig(OWNER, "otpCopy", on);
}

export function useMessageLayout(): MessageLayout {
  const config = useBuiltinConfig(OWNER);
  return normalizeMessageLayout(config[MESSAGE_LAYOUT_CONFIG_KEY]);
}

export async function setMessageLayout(layout: MessageLayout): Promise<void> {
  await setBuiltinConfig(OWNER, MESSAGE_LAYOUT_CONFIG_KEY, layout);
}

function write(source: MessageSource, on: boolean) {
  void setBuiltinConfig(OWNER, source, on).catch((error: unknown) => console.error(`Could not save the ${source} message source switch`, error));
}

export function useSourceReconcile(mailFallback = true) {
  const plugins = useBuiltinPlugins();
  const config = useBuiltinConfig(OWNER);
  useEffect(() => {
    if (!plugins?.some((plugin) => plugin.id === OWNER)) return;
    const stored = { qq: isQQNotificationsEnabled(), wechat: isWeChatRemindersEnabled(), mail: mailFallback };
    for (const [source, on] of migrateSources(stored, config, MESSAGE_SOURCES)) {
      write(source, on);
    }
  }, [plugins, config, mailFallback]);
}
