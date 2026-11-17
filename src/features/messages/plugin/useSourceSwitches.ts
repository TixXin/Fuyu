import { useEffect, useRef } from "react";
import { setBuiltinConfig } from "../../plugin-kernel/builtinSwitches";
import { useBuiltinConfig, useBuiltinPlugins } from "../../plugin-kernel/useBuiltinPlugins";
import { isQQNotificationsEnabled, saveQQNotificationsEnabled } from "../qq-notifications/storage";
import { isWeChatRemindersEnabled, saveWeChatRemindersEnabled } from "../wechat/storage";
import { OWNER } from "./owner.ts";
import { MIRRORED_SOURCES, reconcileSources, type MirroredSource, type SourceValues } from "./sourceSwitches.ts";

const MIRRORS: Record<MirroredSource, (on: boolean) => void> = {
  qq: saveQQNotificationsEnabled,
  wechat: saveWeChatRemindersEnabled,
};

export async function setSourceEnabled(source: MirroredSource, on: boolean): Promise<void> {
  await setBuiltinConfig(OWNER, source, on);
  MIRRORS[source](on);
}

function write(source: MirroredSource, on: boolean) {
  void setBuiltinConfig(OWNER, source, on).catch((error: unknown) => console.error(`Could not save the ${source} message source switch`, error));
}

export function useSourceReconcile() {
  const plugins = useBuiltinPlugins();
  const config = useBuiltinConfig(OWNER);
  const seen = useRef<SourceValues | null>(null);
  useEffect(() => {
    if (!plugins) return;
    const stored: SourceValues = { qq: isQQNotificationsEnabled(), wechat: isWeChatRemindersEnabled() };
    const result = reconcileSources(stored, config, seen.current, MIRRORED_SOURCES);
    for (const [source, on] of result.write) write(source, on);
    for (const [source, on] of result.mirror) {
      MIRRORS[source](on);
      stored[source] = on;
    }
    seen.current = stored;
  }, [plugins, config]);
}
