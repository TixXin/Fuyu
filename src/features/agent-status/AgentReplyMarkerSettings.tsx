import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useErrorText, useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import { RemoteResultLines } from "./RemoteResultLines";
import "./AgentReplyMarkerSettings.css";
import { getReplyMarkerState, setReplyMarker, type ReplyMarkerFile, type ReplyMarkerState } from "./api";
import { AGENT_PROVIDER_LABELS } from "./status";

function ReplyMarkerFileItem({ file }: { file: ReplyMarkerFile }) {
  const text = useTranslation().settings.agent.replyMarker;
  const badgeText = file.error
    ? text.fileError
    : file.outdated
      ? text.fileOutdated
      : file.installed
        ? text.fileInstalled
        : text.filePending;
  const badgeTone = file.error ? "error" : file.outdated ? "warn" : file.installed ? "ok" : "muted";

  return (
    <li className={file.error ? "agent-reply-marker__file agent-reply-marker__file--error" : "agent-reply-marker__file"}>
      <div className="agent-reply-marker__file-row">
        <span className="agent-reply-marker__file-agent">
          <AgentProviderIcon provider={file.agent} size={15} />
          <strong>{AGENT_PROVIDER_LABELS[file.agent] ?? file.agent}</strong>
        </span>
        <span className="agent-reply-marker__file-path">
          <code>{file.path}</code>
          {file.target ? <span className="agent-reply-marker__file-link"> ({text.linked(file.target)})</span> : null}
        </span>
        <span className={`agent-reply-marker__badge agent-reply-marker__badge--${badgeTone}`}>{badgeText}</span>
      </div>
      {file.error ? <div className="agent-reply-marker__file-error">{file.error}</div> : null}
    </li>
  );
}

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
          <SettingsFootnote text={text.hint} />
          <RemoteResultLines results={state?.remotes} />
          {error ? <p className="agent-reply-marker__alert" role="alert">{error}</p> : null}
        </>
      }
    >
      <SettingsToggleRow title={text.toggle} checked={state?.installed ?? false} onChange={toggle} />
      <div className="agent-reply-marker__legend" data-search="off">
        <div className="agent-reply-marker__pill">
          <span className="agent-reply-marker__symbol agent-reply-marker__symbol--turn" aria-hidden="true">↩</span>
          <div className="agent-reply-marker__pill-text">
            <strong>{text.legendTurn}</strong>
            <span>{text.legendTurnHint}</span>
          </div>
        </div>
        <div className="agent-reply-marker__pill">
          <span className="agent-reply-marker__symbol agent-reply-marker__symbol--bg" aria-hidden="true">⋯</span>
          <div className="agent-reply-marker__pill-text">
            <strong>{text.legendBg}</strong>
            <span>{text.legendBgHint}</span>
          </div>
        </div>
        <div className="agent-reply-marker__pill">
          <span className="agent-reply-marker__symbol agent-reply-marker__symbol--done" aria-hidden="true">✓</span>
          <div className="agent-reply-marker__pill-text">
            <strong>{text.legendDone}</strong>
            <span>{text.legendDoneHint}</span>
          </div>
        </div>
      </div>
      {state ? (
        <div className="agent-reply-marker__section" data-search="off">
          <div className="agent-reply-marker__section-head">
            <span>{text.filesTitle}</span>
          </div>
          {state.installed && state.outdated ? (
            <p className="agent-reply-marker__outdated" role="status">
              <CircleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
              <span>{text.outdated}</span>
            </p>
          ) : null}
          {state.files.length === 0 ? (
            <p className="agent-reply-marker__empty">{text.noFiles}</p>
          ) : (
            <ul className="agent-reply-marker__files">
              {state.files.map((file) => (
                <ReplyMarkerFileItem key={`${file.agent}:${file.path}`} file={file} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {state ? (
        <details className="agent-reply-marker__preview" data-search="off">
          <summary>{text.preview}</summary>
          <pre>{state.content}</pre>
        </details>
      ) : null}
    </SettingsGroup>
  );
}
