import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { listenAgentTestNotice, reportAgentTestNotice, type AgentSessionSummary } from "./api";
import type { AgentApprovalRequest } from "./approvals/api";
import type { AgentApprovals } from "./approvals/useAgentApprovals";
import { PREVIEW_SOUND } from "./reminder-settings/previewEvents";
import { playAgentSound } from "./sounds/player";
import type { AgentSoundSettings } from "./sounds/storage";
import { stampTestNotice, type TestNoticeOutcome } from "./testNotice";
import { sessionKey } from "./unseen";
import type { AgentAlerts } from "./useAgentAlerts";

type TestCard = { key: string; request: AgentApprovalRequest; session: AgentSessionSummary };

type AgentTestNoticeOptions = {
  cards: boolean;
  approvals: AgentApprovals;
  alerted: AgentAlerts["alerted"];
  showTest: AgentAlerts["showTest"];
  dismissTest: AgentAlerts["dismissTest"];
  sounds: AgentSoundSettings;
};

function failed(error: unknown) {
  console.error("Failed to handle the agent test notice", error);
}

export function useAgentTestNotice({ cards, approvals, alerted, showTest, dismissTest, sounds }: AgentTestNoticeOptions): AgentApprovals {
  const [card, setCard] = useState<TestCard | null>(null);
  const realId = approvals.current?.id ?? null;
  const latest = useRef({ cards, busy: realId !== null, showTest, sounds });
  useLayoutEffect(() => {
    latest.current = { cards, busy: realId !== null, showTest, sounds };
  });

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenAgentTestNotice((test) => {
      const current = latest.current;
      const stamped = stampTestNotice(test, Date.now());
      let outcome: TestNoticeOutcome = current.busy ? "busy" : current.showTest(stamped.alerts);
      if (outcome === "shown") {
        const session = stamped.alerts[0]?.session;
        const next = current.cards && stamped.request && session ? { key: sessionKey(session), request: stamped.request, session } : null;
        setCard(next);
        if (next) outcome = "shownCard";
        const sound = PREVIEW_SOUND[test.event];
        if (current.sounds.enabled && current.sounds.events[sound]) playAgentSound(sound, current.sounds);
      }
      void reportAgentTestNotice({ id: test.id, outcome }).catch(failed);
    })
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch(failed);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (realId !== null) dismissTest();
  }, [realId, dismissTest]);

  const shown = card && alerted?.key === card.key ? card : null;
  return useMemo(
    () => (approvals.current || !shown ? approvals : { ...approvals, current: shown.request, queued: 0, decide: dismissTest, sample: shown.session }),
    [approvals, shown, dismissTest],
  );
}
