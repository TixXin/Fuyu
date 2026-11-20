import { useEffect, useRef } from "react";
import type { Translations } from "../../i18n";
import { islandNoticesV1 } from "../../lib/island-notices/service";
import { loadDevBuild } from "../../lib/platform";
import { windowServices } from "../plugin-kernel/services";
import { getAgentHooksState, installAgentHooks } from "./api";
import { autoHookKey, autoHookTargets, hookStateOf } from "./hookPlan";
import { AGENT_PROVIDER_LABELS, getAgentProviderLabel } from "./status";
import { OWNER } from "./plugin/owner.ts";

const FIRST_CHECK_MS = 20_000;
const CHECK_EVERY_MS = 10 * 60_000;
const NOTICE_MS = 6_000;
const PROVIDERS = Object.keys(AGENT_PROVIDER_LABELS);

type AutoSetupOptions = { hidden: readonly string[]; install: boolean; update: boolean; t: Translations };

async function runAutoSetup({ hidden, install, update, t }: AutoSetupOptions, tried: Set<string>) {
  if ((!install && !update) || (await loadDevBuild())) return;
  const before = await getAgentHooksState();
  const targets = autoHookTargets(before, PROVIDERS, hidden, { install, update }, tried);
  if (targets.length === 0) return;
  for (const provider of targets) tried.add(autoHookKey(before, provider));
  await installAgentHooks(targets);
  const after = await getAgentHooksState();
  const done = targets.filter((provider) => hookStateOf(after, provider) === "current");
  if (done.length === 0) return;
  const added = done.filter((provider) => hookStateOf(before, provider) === "notInstalled");
  const names = (list: string[]) => list.map(getAgentProviderLabel).join(t.agent.autoHooks.join);
  await windowServices.get(islandNoticesV1).notify({
    pluginId: OWNER,
    pluginName: null,
    title: added.length > 0 ? t.agent.autoHooks.connected(names(added)) : t.agent.autoHooks.updated(names(done)),
    body: t.agent.autoHooks.body,
    durationMs: NOTICE_MS,
    actions: [],
  });
}

export function useAgentHooksAutoSetup(enabled: boolean, options: AutoSetupOptions) {
  const latest = useRef(options);
  const tried = useRef(new Set<string>());

  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    if (!enabled) return;
    const run = () => void runAutoSetup(latest.current, tried.current).catch((error: unknown) => console.error("Failed to set up agent hooks", error));
    const first = window.setTimeout(run, FIRST_CHECK_MS);
    const timer = window.setInterval(run, CHECK_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [enabled]);
}
