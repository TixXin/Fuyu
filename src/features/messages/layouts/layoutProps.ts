import type { MailController } from "../mail/MailPanel";
import type { MessageFeed } from "../feed/types";
import type { FeedChrome } from "./FeedMenus";

export type FeedLayoutProps = {
  feed: MessageFeed;
  chrome: FeedChrome;
  mail: MailController;
  onOpenSettings?: () => void;
};
