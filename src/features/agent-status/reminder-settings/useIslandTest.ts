import { useCallback, useEffect, useRef, useState } from "react";
import { listenAgentTestNoticeResult, requestAgentTestNotice } from "../api";
import { testNoticeRequest, type TestNoticeOutcome } from "../testNotice";
import type { PreviewEvent } from "./previewEvents";
import type { PreviewSamples } from "./previewSamples";

export const ISLAND_TEST_REPLY_MS = 1500;
export const ISLAND_TEST_NOTE_MS = 8000;

export type IslandTestOutcome = TestNoticeOutcome | "noReply";

export type IslandTestResult = { event: PreviewEvent; outcome: IslandTestOutcome };

export type IslandTest = {
  sending: boolean;
  result: IslandTestResult | null;
  run: (event: PreviewEvent, samples: PreviewSamples) => void;
  clear: () => void;
};

type Pending = { id: number; event: PreviewEvent };

export function useIslandTest(): IslandTest {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<IslandTestResult | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const finish = useCallback((outcome: IslandTestOutcome) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    window.clearTimeout(timerRef.current);
    setSending(false);
    setResult({ event: pending.event, outcome });
    timerRef.current = window.setTimeout(() => setResult(null), ISLAND_TEST_NOTE_MS);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenAgentTestNoticeResult((answer) => {
      if (pendingRef.current?.id === answer.id) finish(answer.outcome);
    })
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch((error: unknown) => console.error("Failed to listen for the island's answer to a test notice", error));
    return () => {
      cancelled = true;
      stop?.();
      window.clearTimeout(timerRef.current);
    };
  }, [finish]);

  const run = useCallback((event: PreviewEvent, samples: PreviewSamples) => {
    if (pendingRef.current) return;
    const id = Date.now();
    pendingRef.current = { id, event };
    window.clearTimeout(timerRef.current);
    setResult(null);
    setSending(true);
    timerRef.current = window.setTimeout(() => finish("noReply"), ISLAND_TEST_REPLY_MS);
    void requestAgentTestNotice(testNoticeRequest(event, samples, id)).catch((error: unknown) => {
      console.error("Failed to ask the island for a test notice", error);
      if (pendingRef.current?.id === id) finish("noReply");
    });
  }, [finish]);

  const clear = useCallback(() => {
    if (pendingRef.current) return;
    window.clearTimeout(timerRef.current);
    setResult(null);
  }, []);

  return { sending, result, run, clear };
}
