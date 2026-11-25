import { useEffect, useId, useState } from "react";
import { CircleCheck, Eye, EyeOff } from "lucide-react";
import { SettingsAdvanced } from "../../../components/settings/SettingsAdvanced";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsInput } from "../../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { useErrorText, useTranslation } from "../../../i18n";
import {
  readNetworkProxy,
  saveNetworkProxy,
  testNetworkProxy,
  type NetworkProxyMode,
  type NetworkProxyScheme,
  type NetworkProxyView,
  type SaveNetworkProxyInput,
} from "../api";
import "./NetworkProxySection.css";

type ProxyDraft = {
  mode: NetworkProxyMode;
  scheme: NetworkProxyScheme;
  host: string;
  portText: string;
  username: string;
  password: string;
  clearPassword: boolean;
  bypass: string;
};

type Feedback = { kind: "ok" | "error"; text: string } | null;

const EMPTY_DRAFT: ProxyDraft = {
  mode: "system",
  scheme: "http",
  host: "",
  portText: "",
  username: "",
  password: "",
  clearPassword: false,
  bypass: "",
};

function draftFromView(view: NetworkProxyView): ProxyDraft {
  return {
    mode: view.mode,
    scheme: view.scheme,
    host: view.host,
    portText: view.port ? String(view.port) : "",
    username: view.username,
    password: "",
    clearPassword: false,
    bypass: view.bypass,
  };
}

function buildInput(draft: ProxyDraft): SaveNetworkProxyInput {
  const trimmedPort = draft.portText.trim();
  const parsedPort = trimmedPort === "" ? null : Number(trimmedPort);
  const port = parsedPort !== null && Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : trimmedPort === "" ? null : 0;
  const password = draft.clearPassword ? "" : draft.password.length > 0 ? draft.password : null;
  return {
    mode: draft.mode,
    scheme: draft.scheme,
    host: draft.host.trim(),
    port,
    username: draft.username.trim(),
    password,
    bypass: draft.bypass.trim(),
  };
}

function isDirty(draft: ProxyDraft, saved: NetworkProxyView | null): boolean {
  if (!saved) return false;
  return (
    draft.mode !== saved.mode ||
    draft.scheme !== saved.scheme ||
    draft.host.trim() !== saved.host ||
    draft.portText.trim() !== (saved.port ? String(saved.port) : "") ||
    draft.username.trim() !== saved.username ||
    draft.bypass.trim() !== saved.bypass ||
    draft.password.length > 0 ||
    draft.clearPassword
  );
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  if (feedback.kind === "ok") {
    return (
      <p className="network-proxy__feedback network-proxy__feedback--ok" role="status">
        <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />
        <span>{feedback.text}</span>
      </p>
    );
  }
  return (
    <p className="network-proxy__feedback network-proxy__feedback--error" role="alert">
      {feedback.text}
    </p>
  );
}

export function NetworkProxySection() {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.networkProxy;
  const hostId = useId();
  const userId = useId();
  const bypassId = useId();
  const [saved, setSaved] = useState<NetworkProxyView | null>(null);
  const [draft, setDraft] = useState<ProxyDraft>(EMPTY_DRAFT);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState<"idle" | "saving" | "testing">("idle");
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    void readNetworkProxy()
      .then((view) => {
        if (cancelled || !view) return;
        setSaved(view);
        setDraft(draftFromView(view));
      })
      .catch((error: unknown) => {
        if (!cancelled) setFeedback({ kind: "error", text: errorText(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [errorText]);

  const updateDraft = (patch: Partial<ProxyDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setFeedback(null);
  };

  const commit = (nextDraft: ProxyDraft, showSavedBanner: boolean) => {
    if (busy !== "idle") return;
    setBusy("saving");
    setFeedback(null);
    void saveNetworkProxy(buildInput(nextDraft))
      .then((view) => {
        setSaved(view);
        setDraft(draftFromView(view));
        setRevealed(false);
        if (showSavedBanner) setFeedback({ kind: "ok", text: text.saved });
      })
      .catch((error: unknown) => {
        setFeedback({ kind: "error", text: errorText(error) });
      })
      .finally(() => setBusy("idle"));
  };

  const handleModeChange = (mode: NetworkProxyMode) => {
    const nextDraft = { ...draft, mode };
    setDraft(nextDraft);
    setFeedback(null);
    if (mode !== "manual") {
      commit(nextDraft, false);
    }
  };

  const handleTest = () => {
    if (busy !== "idle") return;
    setBusy("testing");
    setFeedback(null);
    void testNetworkProxy(buildInput(draft))
      .then((result) => {
        setFeedback({ kind: "ok", text: text.testOk(result.latencyMs, result.via) });
      })
      .catch((error: unknown) => {
        setFeedback({ kind: "error", text: errorText(error) });
      })
      .finally(() => setBusy("idle"));
  };

  const onEnterSave = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && busy === "idle" && isDirty(draft, saved)) {
      commit(draft, true);
    }
  };

  const modeDescription =
    draft.mode === "system" ? (
      saved?.systemProxy ? (
        <span className="network-proxy__detected">
          <span>{text.systemDetectedPrefix}</span>
          <code className="network-proxy__code">{saved.systemProxy}</code>
        </span>
      ) : (
        text.systemNone
      )
    ) : draft.mode === "direct" ? (
      text.directHint
    ) : undefined;

  const dirty = isDirty(draft, saved);

  return (
    <SettingsGroup
      title={text.title}
      action={
        draft.mode !== "manual" ? (
          <SettingsLinkButton disabled={busy !== "idle"} onClick={handleTest}>
            {busy === "testing" ? text.testing : text.test}
          </SettingsLinkButton>
        ) : undefined
      }
      footer={<SettingsFootnote text={text.footnote} />}
    >
      <SettingsRow
        title={text.modeLabel}
        description={modeDescription}
        control={
          <SettingsChoice
            value={draft.mode}
            ariaLabel={text.modeLabel}
            disabled={busy !== "idle"}
            options={[
              { value: "system", label: text.modeSystem },
              { value: "manual", label: text.modeManual },
              { value: "direct", label: text.modeDirect },
            ]}
            onChange={handleModeChange}
          />
        }
      >
        {draft.mode !== "manual" ? <FeedbackLine feedback={feedback} /> : null}
      </SettingsRow>

      {draft.mode === "manual" ? (
        <>
          <SettingsRow title={text.serverLabel} description={text.serverDescription} labelFor={hostId}>
            <div className="network-proxy__endpoint">
              <div className="network-proxy__scheme">
                <SettingsSelect
                  value={draft.scheme}
                  ariaLabel={text.schemeAriaLabel}
                  options={[
                    { value: "http", label: text.schemeHttp },
                    { value: "socks5", label: text.schemeSocks5 },
                  ]}
                  onChange={(value) => {
                    if (value === "http" || value === "socks5") updateDraft({ scheme: value });
                  }}
                />
              </div>
              <SettingsInput
                id={hostId}
                className="network-proxy__host"
                monospace
                autoComplete="off"
                value={draft.host}
                placeholder={text.hostPlaceholder}
                aria-label={text.hostAriaLabel}
                onChange={(event) => updateDraft({ host: event.target.value })}
                onKeyDown={onEnterSave}
              />
              <span className="network-proxy__colon" aria-hidden="true">:</span>
              <SettingsInput
                className="network-proxy__port"
                monospace
                inputMode="numeric"
                value={draft.portText}
                placeholder={text.portPlaceholder}
                aria-label={text.portAriaLabel}
                onChange={(event) => updateDraft({ portText: event.target.value.replace(/[^\d]/g, "").slice(0, 5) })}
                onKeyDown={onEnterSave}
              />
            </div>
          </SettingsRow>

          <SettingsAdvanced label={text.advancedLabel}>
            <SettingsRow
              title={text.authLabel}
              description={draft.clearPassword ? text.passwordWillClear : text.authDescription}
              labelFor={userId}
              control={
                saved?.hasPassword && !draft.clearPassword ? (
                  <SettingsLinkButton tone="danger" onClick={() => updateDraft({ password: "", clearPassword: true })}>
                    {text.clearPassword}
                  </SettingsLinkButton>
                ) : undefined
              }
            >
              <div className="network-proxy__auth">
                <SettingsInput
                  id={userId}
                  autoComplete="off"
                  value={draft.username}
                  placeholder={text.usernamePlaceholder}
                  aria-label={text.usernamePlaceholder}
                  onChange={(event) => updateDraft({ username: event.target.value })}
                  onKeyDown={onEnterSave}
                />
                <div className="network-proxy__secret">
                  <SettingsInput
                    type={revealed ? "text" : "password"}
                    autoComplete="new-password"
                    value={draft.password}
                    placeholder={saved?.hasPassword && !draft.clearPassword ? text.passwordSavedPlaceholder : text.passwordPlaceholder}
                    aria-label={text.passwordPlaceholder}
                    onChange={(event) => updateDraft({ password: event.target.value, clearPassword: false })}
                    onKeyDown={onEnterSave}
                  />
                  {draft.password ? (
                    <button
                      type="button"
                      className="network-proxy__eye"
                      aria-label={revealed ? t.common.hideSecret : t.common.showSecret}
                      onClick={() => setRevealed((current) => !current)}
                    >
                      {revealed ? <EyeOff size={14} strokeWidth={2} aria-hidden="true" /> : <Eye size={14} strokeWidth={2} aria-hidden="true" />}
                    </button>
                  ) : null}
                </div>
              </div>
            </SettingsRow>

            <SettingsRow title={text.bypassLabel} description={text.bypassDescription} labelFor={bypassId}>
              <SettingsInput
                id={bypassId}
                monospace
                autoComplete="off"
                value={draft.bypass}
                placeholder={text.bypassPlaceholder}
                aria-label={text.bypassLabel}
                onChange={(event) => updateDraft({ bypass: event.target.value })}
                onKeyDown={onEnterSave}
              />
            </SettingsRow>
          </SettingsAdvanced>

          <div className="network-proxy__footer-bar">
            <div className="network-proxy__actions">
              <button
                type="button"
                className="network-proxy__button network-proxy__button--primary"
                disabled={busy !== "idle" || !dirty}
                onClick={() => commit(draft, true)}
              >
                {busy === "saving" ? text.saving : text.save}
              </button>
              <button
                type="button"
                className="network-proxy__button"
                disabled={busy !== "idle"}
                onClick={handleTest}
              >
                {busy === "testing" ? text.testing : text.test}
              </button>
            </div>
            <FeedbackLine feedback={feedback} />
          </div>
        </>
      ) : null}
    </SettingsGroup>
  );
}
