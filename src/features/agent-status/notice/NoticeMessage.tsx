import type { CSSProperties } from "react";
import { Markdown } from "../../../components/markdown/Markdown";
import { openAgentLink } from "../api";
import { useNoticeScroll } from "./useNoticeScroll";
import "./NoticeMessage.css";

export function NoticeMessage({ text, lines, markdown }: { text: string; lines: number; markdown: boolean }) {
  const scroll = useNoticeScroll(text);
  const { can, fadeTop, fadeBottom, scrolling, dragging, thumb } = scroll.state;
  return (
    <div className={`agent-notice-message${can ? " agent-notice-message--scrolls" : ""}`} style={{ "--notice-lines": lines } as CSSProperties}>
      <div
        ref={scroll.ref}
        className="agent-notice-message__text"
        data-fade-top={fadeTop || undefined}
        data-fade-bottom={fadeBottom || undefined}
        onScroll={scroll.onScroll}
      >
        {markdown ? <Markdown text={text} onOpenLink={openAgentLink} className="agent-notice-message__markdown" /> : <p className="agent-notice-message__plain">{text}</p>}
      </div>
      {can && (
        <i
          className={`agent-notice-message__thumb${scrolling ? " agent-notice-message__thumb--on" : ""}${dragging ? " agent-notice-message__thumb--drag" : ""}`}
          style={{ height: thumb.height, transform: `translateY(${thumb.offset}px)` }}
          aria-hidden="true"
          onPointerDown={scroll.onThumbPointerDown}
        />
      )}
    </div>
  );
}
