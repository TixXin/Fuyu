import type { CSSProperties } from "react";
import { useTranslation } from "../../../i18n";
import { unreadTotal } from "../feed/feedModel";
import { BoardColumn } from "./BoardColumn";
import { FeedEmpty } from "./FeedEmpty";
import { FeedMoreMenu, LayoutMenu } from "./FeedMenus";
import type { FeedLayoutProps } from "./layoutProps";
import "./BoardLayout.css";

export function BoardLayout({ feed, chrome, onOpenSettings }: FeedLayoutProps) {
  const t = useTranslation();
  const text = t.messages.feed;
  const { items, sources, now, actions } = feed;
  return (
    <section className="feed-layout board-layout" aria-label={text.layouts.board.name}>
      <header className="feed-head">
        <span className="feed-head__title">{text.layouts.board.name}</span>
        <span className="feed-head__count">{text.unread(unreadTotal(items))}</span>
        <span className="feed-tools"><LayoutMenu layout={chrome.layout} onLayout={chrome.onLayout} /><FeedMoreMenu feed={feed} chrome={chrome} /></span>
      </header>
      {sources.length === 0 ? <FeedEmpty sources={sources} items={items} now={now} onOpenSettings={onOpenSettings} /> : (
        <div className="board-layout__columns" style={{ "--board-columns": String(Math.min(sources.length, 3)) } as CSSProperties}>
          {sources.map((source) => (
            <BoardColumn key={source.id} source={source} items={items.filter((item) => item.source === source.id)} now={now} actions={actions} onDetails={() => chrome.onDetails(source.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
