import type { ComponentType } from "react";
import type { MessageLayout } from "../feed/messageLayout";
import type { FeedControllers } from "../feed/types";
import { useMessageFeed } from "../feed/useMessageFeed";
import type { MessageSource } from "../messagePreview";
import { setMessageLayout } from "../plugin/useSourceSwitches";
import { BoardLayout } from "./BoardLayout";
import { FocusLayout } from "./FocusLayout";
import { InboxLayout } from "./InboxLayout";
import type { FeedLayoutProps } from "./layoutProps";
import { ReaderLayout } from "./ReaderLayout";
import { StacksLayout } from "./StacksLayout";
import { TimelineLayout } from "./TimelineLayout";
import "./MessageFeed.css";

const LAYOUTS: Record<MessageLayout, ComponentType<FeedLayoutProps>> = {
  focus: FocusLayout,
  inbox: InboxLayout,
  reader: ReaderLayout,
  stacks: StacksLayout,
  board: BoardLayout,
  timeline: TimelineLayout,
};

const saveLayout = (layout: MessageLayout) => {
  void setMessageLayout(layout).catch((error: unknown) => console.error("Could not save the messages layout", error));
};

export function MessageFeedView({ layout, hidden = false, controllers, onDetails }: {
  layout: MessageLayout;
  hidden?: boolean;
  controllers: FeedControllers;
  onDetails: (source: MessageSource) => void;
}) {
  const feed = useMessageFeed(controllers);
  const Layout = LAYOUTS[layout];
  return (
    <div className="feed-shell" data-layout={layout} hidden={hidden}>
      <Layout
        feed={feed}
        chrome={{ layout, onLayout: saveLayout, onDetails }}
        mail={controllers.qqMail}
        onOpenSettings={controllers.onOpenMailSettings}
      />
    </div>
  );
}
