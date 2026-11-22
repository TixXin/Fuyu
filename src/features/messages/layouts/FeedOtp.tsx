import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../i18n";

export function useCopied(copy: (text: string) => Promise<boolean>) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = (key: string, text: string) => {
    void copy(text).then((ok) => {
      if (!ok) return;
      setCopied(key);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1400);
    });
  };
  return { copied, run };
}

export function FeedOtp({ code, copy }: { code: string; copy: (text: string) => Promise<boolean> }) {
  const t = useTranslation();
  const { copied, run } = useCopied(copy);
  const done = copied === code;
  return (
    <span className="feed-otp">
      <code>{code}</code>
      <button type="button" className={done ? "feed-otp__copy feed-otp__copy--done" : "feed-otp__copy"} aria-label={done ? t.messages.feed.copied : t.messages.copyCode(code)} onClick={(event) => { event.stopPropagation(); run(code, code); }}>
        {done ? <Check size={12} strokeWidth={2.2} aria-hidden="true" /> : <Copy size={12} strokeWidth={1.9} aria-hidden="true" />}
        {done ? t.messages.feed.copied : t.messages.feed.copy}
      </button>
    </span>
  );
}
