import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../../i18n";
import type { TargetEntry } from "./plan";
import { listPushTargets, type PushTarget, type PushTargetState } from "./targets";

const REFRESH_MS = 5_000;

export type PushTargets = {
  entries: TargetEntry[];
  errors: Record<string, string>;
  loaded: boolean;
  refresh: () => Promise<void>;
};

export function usePushTargets(): PushTargets {
  const errorText = useErrorText();
  const [targets, setTargets] = useState<PushTarget[]>([]);
  const [states, setStates] = useState<Record<string, PushTargetState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void listPushTargets()
      .then((list) => alive && setTargets(list))
      .catch((error: unknown) => console.error("Failed to list the computers for push", error));
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled(targets.map((target) => target.read()));
    const nextStates: Record<string, PushTargetState> = {};
    const nextErrors: Record<string, string> = {};
    results.forEach((result, at) => {
      const id = targets[at].id;
      if (result.status === "fulfilled") nextStates[id] = result.value;
      else nextErrors[id] = errorText(result.reason);
    });
    setStates(nextStates);
    setErrors(nextErrors);
    if (targets.length > 0) setLoaded(true);
  }, [targets, errorText]);

  useEffect(() => {
    if (targets.length === 0) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [targets, refresh]);

  return { entries: targets.map((target) => ({ target, state: states[target.id] ?? null })), errors, loaded, refresh };
}
