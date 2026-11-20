import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Markdown } from "../../components/markdown/Markdown";
import { looksLikeMarkdown } from "../../components/markdown/markdownText";
import { linkify } from "../../components/markdown/parseMarkdown";
import { useTranslation } from "../../i18n";
import "./MessageBody.css";

const MARKDOWN_OPTIONS = { emphasis: false, breaks: true, autolink: true } as const;

export function MessageBody({ text, onOpenLink, onActivate }: {
  text: string;
  onOpenLink: (href: string) => void;
  onActivate: () => void;
}) {
  const t = useTranslation();
  const markdown = useMemo(() => looksLikeMarkdown(text), [text]);
  const plain = useMemo(() => (markdown ? [] : linkify(text)), [markdown, text]);
  const clipRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const clip = clipRef.current;
    if (!clip || expanded) return;
    const measure = () => setOverflows(clip.scrollHeight > clip.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(clip);
    return () => observer.disconnect();
  }, [text, expanded]);

  const activate = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    if (window.getSelection()?.toString()) return;
    onActivate();
  };

  const clipped = overflows && !expanded;
  return (
    <div className={`message-body${expanded ? " message-body--expanded" : ""}${clipped ? " message-body--clipped" : ""}`} onClick={activate}>
      <div className="message-body__clip" ref={clipRef}>
        {markdown ? (
          <Markdown className="message-body__markdown" text={text} onOpenLink={onOpenLink} options={MARKDOWN_OPTIONS} />
        ) : (
          <p className="message-body__plain">
            {plain.map((part, index) => part.type === "link" ? (
              <a key={index} href={part.href} onClick={(event) => { event.preventDefault(); onOpenLink(part.href); }}>{part.text}</a>
            ) : part.text)}
          </p>
        )}
      </div>
      {(overflows || expanded) && (
        <button className="message-body__toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
          {expanded ? t.messages.showLessMessage : t.messages.showFullMessage}
        </button>
      )}
    </div>
  );
}
