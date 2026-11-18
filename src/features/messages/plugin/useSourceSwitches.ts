import { useEffect } from "react";
import { setBuiltinConfig } from "../../plugin-kernel/builtinSwitches";
import { useBuiltinConfig, useBuiltinPlugins } from "../../plugin-kernel/useBuiltinPlugins";
import { isQQNotificationsEnabled } from "../qq-notifications/storage";
import { isWeChatRemindersEnabled } from "../wechat/storage";
import { OWNER } from "./owner.ts";
import {
  imAutoClearKey,
  imSourceEnabled,
  isImAutoClearEnabled,
  MESSAGE_SOURCES,
  migrateSources,
  sourceSwitch,
  type ImSourceId,
  type MessageSource,
} from "./sourceSwitches.ts";

export async function setSourceEnabled(source: MessageSource, on: boolean): Promise<void> {
  await setBuiltinConfig(OWNER, source, on);
}

export async function setImAutoClearEnabled(source: ImSourceId, on: boolean): Promise<void> {
  await setBuiltinConfig(OWNER, imAutoClearKey(source), on);
}

export function useImSourceAutoClear(source: ImSourceId): boolean {
  const config = useBuiltinConfig(OWNER);
  return isImAutoClearEnabled(config, source);
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
