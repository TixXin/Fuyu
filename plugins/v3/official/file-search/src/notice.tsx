import { useState } from "react";
import { WINGET_ES, WINGET_EVERYTHING, type SearchResult } from "./model.ts";
import { text } from "./text.ts";

interface NoticeProps {
  result: SearchResult;
  onStart: () => Promise<boolean>;
  onDownload: () => void;
  onRetry: () => void;
}

function CommandLine({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      void navigator.clipboard.writeText(command).then(
        () => setCopied(true),
        () => setCopied(false),
      );
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="fuyu-file-search__command">
      <code>{command}</code>
      <button type="button" className="fuyu-file-search__chip" onClick={copy}>
        {copied ? text.copied : text.copy}
      </button>
    </div>
  );
}

export function Notice({ result, onStart, onDownload, onRetry }: NoticeProps) {
  const [starting, setStarting] = useState(false);

  if (result.status === "no-everything") {
    return (
      <div className="fuyu-file-search__notice">
        <p className="fuyu-file-search__notice-title">{text.noEverything}</p>
        <p>{text.noEverythingHint}</p>
        <CommandLine command={WINGET_EVERYTHING} />
        <CommandLine command={WINGET_ES} />
        <p className="fuyu-file-search__muted">{text.lite}</p>
        <div className="fuyu-file-search__actions">
          <button type="button" className="fuyu-file-search__button" onClick={onDownload}>
            {text.download}
          </button>
          <button type="button" className="fuyu-file-search__button" onClick={onRetry}>
            {text.retry}
          </button>
        </div>
      </div>
    );
  }

  if (result.status === "no-es") {
    return (
      <div className="fuyu-file-search__notice">
        <p className="fuyu-file-search__notice-title">{text.noEs}</p>
        <p>{text.noEsHint}</p>
        <CommandLine command={WINGET_ES} />
        <div className="fuyu-file-search__actions">
          <button type="button" className="fuyu-file-search__button" onClick={onDownload}>
            {text.download}
          </button>
          <button type="button" className="fuyu-file-search__button" onClick={onRetry}>
            {text.retry}
          </button>
        </div>
      </div>
    );
  }

  if (result.status === "not-running") {
    const start = async () => {
      setStarting(true);
      const ok = await onStart();
      setStarting(false);
      if (ok) onRetry();
    };
    return (
      <div className="fuyu-file-search__notice">
        <p className="fuyu-file-search__notice-title">{text.notRunning}</p>
        <div className="fuyu-file-search__actions">
          {result.canStart && (
            <button type="button" className="fuyu-file-search__button fuyu-file-search__button--primary" disabled={starting} onClick={() => void start()}>
              {starting ? text.starting : text.startEverything}
            </button>
          )}
          <button type="button" className="fuyu-file-search__button" onClick={onRetry}>
            {text.retry}
          </button>
        </div>
      </div>
    );
  }

  if (result.status === "unsupported") {
    return <p className="fuyu-file-search__empty">{text.unsupported}</p>;
  }

  const detail = result.message === "timeout" ? text.timeout : result.message;
  return (
    <div className="fuyu-file-search__notice">
      <p className="fuyu-file-search__notice-title">{text.failed}</p>
      {detail && <p className="fuyu-file-search__muted">{detail}</p>}
      <div className="fuyu-file-search__actions">
        <button type="button" className="fuyu-file-search__button" onClick={onRetry}>
          {text.retry}
        </button>
      </div>
    </div>
  );
}
