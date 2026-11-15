import { Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { allowFromValid, openCcConnectLink, type CcConnectBotCheck } from "../../../features/cc-connect/api";
import { useErrorText, useTranslation } from "../../../i18n";
import { FeishuScan } from "./FeishuScan";
import type { PlannedProject } from "./plan";
import type { PushPlatform } from "./platforms";
import type { PushTarget } from "./targets";

export function ConnectRow({ target, project, title, platform, connected, scanning, onScanning, prepare, onConnected }: {
  target: PushTarget;
  project: PlannedProject;
  title: string;
  platform: PushPlatform;
  connected: boolean;
  scanning: string | null;
  onScanning: (key: string | null) => void;
  prepare: () => Promise<void>;
  onConnected: () => void;
}) {
  const text = useTranslation().onboarding.push.connect;
  const errorText = useErrorText();
  const [token, setToken] = useState("");
  const [allowFrom, setAllowFrom] = useState("");
  const [bot, setBot] = useState<CcConnectBotCheck | null>(null);
  const [busy, setBusy] = useState<"check" | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const spec = { project: project.name, agent: project.agent, platform };

  const run = async (kind: "check" | "add", work: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await work();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  };
  const check = () =>
    run("check", async () => {
      setBot(null);
      const found = await target.checkBot(platform, token.trim());
      setBot(found);
      if (found.senders.length === 1 && !allowFrom) setAllowFrom(found.senders[0].id);
    });
  const connect = () =>
    run("add", async () => {
      await prepare();
      await target.addProject({ ...spec, token: token.trim(), allowFrom: allowFrom.trim() });
      onConnected();
    });
  const scan = () =>
    run("add", async () => {
      await prepare();
      await target.addProject({ ...spec, token: "", allowFrom: "" });
      onScanning(project.key);
    });
  const canConnect = busy === null && token.trim() !== "" && allowFrom.trim() !== "" && allowFromValid(allowFrom);

  return (
    <li className="push-act__row push-act__row--connect" data-project={project.name}>
      <div className="push-act__main">
        <span className="push-act__name">{project.name}</span>
        <span className="push-act__note">{title}</span>
        {connected ? null : platform === "feishu" ? (
          scanning === project.key ? (
            <FeishuScan
              target={target}
              onDone={() => {
                onScanning(null);
                onConnected();
              }}
              onEnd={() => onScanning(null)}
            />
          ) : null
        ) : (
          <>
            <div className="push-act__inline">
              <input
                className="push-act__input"
                type="password"
                autoComplete="off"
                placeholder={text.token}
                aria-label={text.token}
                value={token}
                onChange={(event) => {
                  setToken(event.currentTarget.value);
                  setBot(null);
                }}
              />
              <button className="onboarding__button" type="button" disabled={!token.trim() || busy !== null} onClick={() => void check()}>
                {busy === "check" ? text.checking : platform === "telegram" ? text.find : text.check}
              </button>
            </div>
            {bot ? (
              <div className="push-act__inline">
                <span className="push-act__note">{text.bot(bot.name)}</span>
                {bot.inviteUrl ? (
                  <button className="push-act__link" type="button" onClick={() => void openCcConnectLink(bot.inviteUrl ?? "")}>
                    {text.invite}
                    <ExternalLink size={11} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {platform === "telegram" && bot ? (
              bot.senders.length > 0 ? (
                <div className="push-act__senders">
                  <span className="push-act__note">{text.senders}</span>
                  {bot.senders.map((sender) => (
                    <button key={sender.id} className="push-act__link" type="button" aria-pressed={allowFrom === sender.id} onClick={() => setAllowFrom(sender.id)}>
                      {`${sender.name} · ${sender.id}`}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="push-act__note">{text.noSenders}</span>
              )
            ) : null}
            <div className="push-act__inline">
              <input className="push-act__input" placeholder={text.allowFrom} aria-label={text.allowFrom} value={allowFrom} onChange={(event) => setAllowFrom(event.currentTarget.value)} />
              <button className="onboarding__button onboarding__button--primary" type="button" disabled={!canConnect} onClick={() => void connect()}>
                {busy === "add" ? text.connecting : text.connect}
              </button>
            </div>
          </>
        )}
        {error ? <span className="push-act__error">{error}</span> : null}
      </div>
      {connected ? (
        <span className="push-act__done">
          <Check size={14} aria-hidden="true" />
          {text.connected}
        </span>
      ) : platform === "feishu" && scanning !== project.key ? (
        <button className="onboarding__button onboarding__button--primary" type="button" disabled={busy !== null || scanning !== null} title={scanning ? text.scanBusy : undefined} onClick={() => void scan()}>
          {busy === "add" ? text.connecting : text.scan}
        </button>
      ) : null}
    </li>
  );
}
