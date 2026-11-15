import { useEffect, useRef, useState } from "react";
import { openCcConnectLink, type CcConnectFeishuSetup } from "../../../features/cc-connect/api";
import { useErrorText, useTranslation } from "../../../i18n";
import type { PushTarget } from "./targets";

const POLL_MS = 1_000;

export function FeishuScan({ target, onDone, onEnd }: { target: PushTarget; onDone: () => void; onEnd: () => void }) {
  const text = useTranslation().onboarding.push.connect;
  const errorText = useErrorText();
  const [state, setState] = useState<CcConnectFeishuSetup | null>(null);
  const running = state?.running ?? true;
  const done = state?.done ?? false;
  const reported = useRef(false);

  useEffect(() => {
    if (!running) return;
    let alive = true;
    const read = () =>
      target
        .feishuProgress()
        .then((next) => alive && setState(next))
        .catch((error: unknown) => console.error("Failed to read the Feishu setup", error));
    void read();
    const timer = window.setInterval(() => void read(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [running, target]);

  useEffect(() => {
    if (running || !done || reported.current) return;
    reported.current = true;
    onDone();
  }, [running, done, onDone]);

  if (!running && !done) {
    return (
      <div className="push-act__inline">
        {state?.error ? <span className="push-act__error">{errorText(state.error)}</span> : null}
        <button className="onboarding__button" type="button" onClick={onEnd}>
          {text.retry}
        </button>
      </div>
    );
  }
  return (
    <div className="push-act__qr">
      {state?.qr ? <img src={state.qr} alt={text.scanQr} width={150} height={150} /> : <span className="push-act__note">{text.scanWaiting}</span>}
      <div className="push-act__inline">
        {state?.url ? (
          <button className="push-act__link" type="button" onClick={() => void openCcConnectLink(state.url ?? "")}>
            {text.scanOpen}
          </button>
        ) : null}
        <button className="onboarding__button" type="button" onClick={() => void target.cancelFeishu().finally(onEnd)}>
          {text.cancel}
        </button>
      </div>
    </div>
  );
}
