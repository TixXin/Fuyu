import { ArrowUpRight, Check, Copy, Moon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import type { FeedItem } from "../feed/feedModel";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { FeedAvatar } from "./FeedAvatar";
import { FeedEmpty } from "./FeedEmpty";
import { FeedMoreMenu, LayoutMenu } from "./FeedMenus";
import { FeedNotices } from "./FeedNotices";
import { useCopied } from "./FeedOtp";
import { FeedStatusLine } from "./FeedStatusLine";
import { FeedTime } from "./FeedTime";
import { FeedUnread } from "./FeedUnread";
import type { FeedLayoutProps } from "./layoutProps";
import "./FocusLayout.css";

const MAX_BARS = 14;

function FocusKey({ icon, label, hint, shortcut, primary, onClick }: { icon: ReactNode; label: string; hint: string; shortcut: string; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={primary ? "focus-key focus-key--primary" : "focus-key"} onClick={onClick} aria-keyshortcuts={shortcut}>
      <span className="focus-key__icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <kbd aria-hidden="true">{hint}</kbd>
    </button>
  );
}

export function FocusLayout({ feed, chrome, onOpenSettings }: FeedLayoutProps) {
  const t = useTranslation();
  const text = t.messages.feed;
  const { items, sources, now, actions } = feed;
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [later, setLater] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const rootRef = useRef<HTMLElement | null>(null);
  const queue = useMemo(() => {
    const open = items.filter((item) => item.unread > 0);
    const rank = (item: FeedItem) => later.indexOf(item.key);
    return [...open.filter((item) => rank(item) < 0), ...open.filter((item) => rank(item) >= 0).sort((a, b) => rank(a) - rank(b))];
  }, [items, later]);
  const current = queue.find((item) => item.key === currentKey) ?? queue[0];
  const index = current ? queue.indexOf(current) : -1;
  const { copied, run: copy } = useCopied(actions.copy);
  const latest = useRef({ current, queue });
  useEffect(() => { latest.current = { current, queue }; });

  const step = (item: FeedItem, skip: boolean) => {
    const next = queue[index + 1] ?? queue.find((entry) => entry.key !== item.key) ?? null;
    if (skip) setLater((previous) => [...previous.filter((key) => key !== item.key), item.key]);
    else setSeen((previous) => (next ? [...previous.filter((key) => key !== item.key), item.key] : []));
    setCurrentKey(skip ? next?.key ?? item.key : next?.key ?? null);
  };
  const handlers = {
    open: (item: FeedItem) => { actions.open(item); if (item.source !== "qqMail") step(item, false); },
    copy: (item: FeedItem) => copy(item.key, item.otp ?? `${item.title}\n${item.text}`),
    later: (item: FeedItem) => step(item, true),
    read: (item: FeedItem) => { actions.read([item]); step(item, false); },
  };
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (!rootRef.current?.isConnected || rootRef.current.closest("[hidden]")) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (target instanceof HTMLButtonElement && (event.key === "Enter" || event.key === " ")) return;
      const item = latest.current.current;
      if (!item) return;
      const key = event.key.toLowerCase();
      const action = key === "enter" ? "open" : key === "c" ? "copy" : key === "s" ? "later" : key === " " ? "read" : null;
      if (!action) return;
      event.preventDefault();
      handlersRef.current[action](item);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const menus = <span className="feed-tools"><LayoutMenu layout={chrome.layout} onLayout={chrome.onLayout} /><FeedMoreMenu feed={feed} chrome={chrome} /></span>;

  if (!current) {
    return (
      <section className="feed-layout focus-layout focus-layout--done" aria-label={text.layouts.focus.name}>
        <header className="feed-head"><span className="feed-head__title">{text.layouts.focus.name}</span>{menus}</header>
        <FeedNotices sources={sources} actions={actions} compact />
        <FeedEmpty sources={sources} items={items} now={now} onOpenSettings={onOpenSettings} />
      </section>
    );
  }

  const source = t.messages.sourceLabels[current.source];
  const rest = queue.filter((item) => item.key !== current.key);
  const done = seen.filter((key) => !queue.some((item) => item.key === key)).length;
  const total = done + queue.length;
  const position = done + index;
  const bars = total <= MAX_BARS;
  const otpDigits = current.otp && current.otp.length <= 10 ? [...current.otp] : null;
  return (
    <section className="feed-layout focus-layout" ref={rootRef} aria-label={text.layouts.focus.name}>
      <FeedNotices sources={sources} actions={actions} compact />
      <div className="focus-layout__body">
        <article className="focus-card" data-source={current.source} key={current.key} aria-live="polite">
          <div className="focus-card__progress">
            <span>{text.progress(position + 1, total)}</span>
            {bars
              ? <span className="focus-card__bars" aria-hidden="true">{Array.from({ length: total }, (_, at) => <i key={at} data-state={at < position ? "past" : at === position ? "current" : "next"} />)}</span>
              : <span className="focus-card__meter" aria-hidden="true"><i style={{ width: `${((position + 1) / total) * 100}%` }} /></span>}
          </div>
          <div className="focus-card__source">
            <MessageSourceIcon source={current.source} size={16} account={current.account} />
            <span>{source}{current.account ? ` · ${current.account}` : ""}</span>
            <FeedTime at={current.at} now={now} />
          </div>
          <h3 className="focus-card__title"><span>{current.title}</span><FeedUnread count={current.unread} /></h3>
          <div className="focus-card__text">
            <p>{current.text}</p>
            {current.plain && <p className="focus-card__hint">{text.plainHint}</p>}
            {otpDigits && <span className="focus-card__otp" aria-label={current.otp ?? ""}>{otpDigits.map((digit, at) => <span key={at}>{digit}</span>)}</span>}
          </div>
          <div className="focus-card__keys">
            <FocusKey primary icon={<ArrowUpRight size={17} strokeWidth={1.8} />} label={current.source === "qqMail" ? text.open : text.openApp(source)} hint={text.keys.open} shortcut="Enter" onClick={() => handlers.open(current)} />
            <FocusKey icon={copied === current.key ? <Check size={17} strokeWidth={2} /> : <Copy size={17} strokeWidth={1.8} />} label={copied === current.key ? text.copied : current.otp ? text.copyCode : text.copy} hint={text.keys.copy} shortcut="C" onClick={() => handlers.copy(current)} />
            <FocusKey icon={<Moon size={17} strokeWidth={1.8} />} label={text.later} hint={text.keys.later} shortcut="S" onClick={() => handlers.later(current)} />
            <FocusKey icon={<Check size={17} strokeWidth={2} />} label={text.read} hint={text.keys.read} shortcut="Space" onClick={() => handlers.read(current)} />
          </div>
        </article>
        <aside className="focus-queue" aria-label={text.upNext}>
          <header className="feed-head"><span className="feed-head__title">{text.upNext}</span><span className="feed-head__count">{text.count(rest.length)}</span>{menus}</header>
          <div className="focus-queue__list feed-scroll">
            {rest.map((item) => (
              <button type="button" className="focus-queue__item" key={item.key} onClick={() => setCurrentKey(item.key)}>
                <FeedAvatar item={item} size={28} />
                <span className="focus-queue__text"><strong>{item.title}</strong><span>{item.text}</span></span>
              </button>
            ))}
          </div>
          <footer className="focus-queue__foot">{current.source !== "qqMail" ? <span className="feed-hint">{text.chatReadHint}</span> : <FeedStatusLine sources={sources} />}</footer>
        </aside>
      </div>
    </section>
  );
}
