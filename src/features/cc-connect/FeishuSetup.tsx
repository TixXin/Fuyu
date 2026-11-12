import { useEffect, useState } from "react";
import { useErrorText, useTranslation } from "../../i18n";
import { cancelCcConnectFeishuSetup, getCcConnectFeishuSetup, openCcConnectLink, type CcConnectFeishuSetup } from "./api";

const POLL_MS = 1_000;

export function FeishuSetup({ onEnd }: { onEnd: () => void }) {
  const t = useTranslation().settings.plugins.ccConnect.setup;
  const errorText = useErrorText();
  const [state, setState] = useState<CcConnectFeishuSetup | null>(null);
  const running = state?.running ?? true;

  useEffect(() => {
    if (!running) return;
    let alive = true;
    const read = () =>
      getCcConnectFeishuSetup()
        .then((next) => alive && setState(next))
        .catch((error: unknown) => console.error("Failed to read the Feishu setup", error));
    void read();
    const timer = window.setInterval(() => void read(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [running]);

  if (running) {
    return (
      <div className="cc-connect-setup__qr">
        {state?.qr ? <img src={state.qr} alt={t.feishuQr} width={180} height={180} /> : <p className="settings-section__hint">{t.feishuWaiting}</p>}
        <div className="cc-connect-setup__actions">
          {state?.url ? (
            <button className="plugin-card__button plugin-card__button--quiet" type="button" onClick={() => void openCcConnectLink(state.url ?? "")}>
              {t.feishuOpen}
            </button>
          ) : null}
          <button className="plugin-card__button" type="button" onClick={() => void cancelCcConnectFeishuSetup().finally(onEnd)}>
            {t.feishuCancel}
          </button>
        </div>
      </div>
    );
  }
  if (state?.done)
    return (
      <>
        <p className="settings-section__hint">{t.feishuDone(state.allowFrom)}</p>
        {state.allowFrom ? null : <p className="plugin-card__error">{t.feishuNoOwner}</p>}
      </>
    );
  return (
    <div className="cc-connect-setup__actions">
      <p className="plugin-card__error">{state?.error ? errorText(state.error) : null}</p>
      <button className="plugin-card__button" type="button" onClick={onEnd}>
        {t.feishuRetry}
      </button>
    </div>
  );
}
