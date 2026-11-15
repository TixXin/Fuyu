import { useEffect, useState } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useErrorText, useTranslation } from "../../i18n";
import { RemoteResultLines } from "./RemoteResultLines";
import "./AgentReplyMarkerSettings.css";
import { getReplyMarkerState, setReplyMarker, type ReplyMarkerState } from "./api";
import { AGENT_PROVIDER_LABELS } from "./status";

export function AgentReplyMarkerSettings() {
  const text = useTranslation().settings.agent.replyMarker;
  const errorText = useErrorText();
  const [state, setState] = useState<ReplyMarkerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReplyMarkerState()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorText(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [errorText]);

  const toggle = (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setReplyMarker(enabled)
      .then(setState)
      .catch((reason: unknown) => setError(errorText(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <SettingsGroup
      title={text.title}
      footer={
        <>
          {text.hint}
          {state ? (
            <ul className="agent-reply-marker__files">
              {state.files.length === 0 ? <li>{text.noFiles}</li> : null}
              {state.files.map((file) => (
                <li key={`${file.agent}:${file.path}`} className={file.error ? "agent-reply-marker__file--error" : undefined}>
                  {AGENT_PROVIDER_LABELS[file.agent] ?? file.agent}: {file.path}
                  {file.target ? ` (${text.linked(file.target)})` : null}
                  {file.error ? <><br />{file.error}</> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {state?.installed && state.outdated ? <><br />{text.outdated}</> : null}
          <RemoteResultLines results={state?.remotes} />
          {error ? <><br />{error}</> : null}
        </>
      }
    >
      <SettingsToggleRow title={text.toggle} checked={state?.installed ?? false} onChange={toggle} />
      {state ? (
        <details className="agent-reply-marker__preview">
          <summary>{text.preview}</summary>
          <pre>{state.content}</pre>
        </details>
      ) : null}
    </SettingsGroup>
  );
}
