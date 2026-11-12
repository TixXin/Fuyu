import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { CC_CONNECT_PLUGIN_ID, programSetting } from "../../cc-connect/api";
import { useBuiltinPlugin } from "../../plugins/useBuiltinPlugin";
import { useTranslation } from "../../../i18n";
import { detectAlerts, phasesOf, type SessionPhases } from "../alerts";
import type { AgentSessionSummary } from "../api";
import { sessionKey } from "../unseen";
import { queuePushes, takeDuePushes, type PushQueue } from "./pushQueue";
import { isAway, sendPush } from "./sendPush";
import { useAgentPushSettings } from "./useAgentPushSettings";

const RECHECK_MS = 15_000;

export function useAgentPush(sessions: AgentSessionSummary[], enabled: boolean, unseen: ReadonlySet<string>) {
  const [settings] = useAgentPushSettings();
  const text = useTranslation().agent.push;
  const ccConnect = useBuiltinPlugin(CC_CONNECT_PLUGIN_ID);
  const phasesRef = useRef<SessionPhases | null>(null);
  const queueRef = useRef<PushQueue>(new Map());
  const latest = useRef({ settings, text, enabled, sessions, unseen, ccConnect });
  useLayoutEffect(() => {
    latest.current = { settings, text, enabled, sessions, unseen, ccConnect };
  });

  const flush = useCallback(async () => {
    const away = await isAway(latest.current.settings.awayMinutes);
    const { settings: push, text: labels, sessions: now, unseen: notLooked, ccConnect: plugin } = latest.current;
    const due = takeDuePushes(queueRef.current, now, away, (session) => !notLooked.has(sessionKey(session)));
    const path = plugin.enabled ? programSetting(plugin.settings) : null;
    for (const alert of due) {
      sendPush(alert, push, { kinds: labels, takeover: labels.takeover }, path).catch((error: unknown) => console.error("Failed to push to the phone", error));
    }
  }, []);

  useEffect(() => {
    const previous = phasesRef.current;
    phasesRef.current = phasesOf(sessions, previous);
    const { settings: push, enabled: on } = latest.current;
    if (!on || !push.enabled) {
      queueRef.current.clear();
      return;
    }
    queuePushes(queueRef.current, detectAlerts(previous, sessions, { started: "off", ...push.events }));
    if (queueRef.current.size > 0) void flush();
  }, [sessions, flush]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (queueRef.current.size > 0) void flush();
    }, RECHECK_MS);
    return () => window.clearInterval(timer);
  }, [flush]);
}
