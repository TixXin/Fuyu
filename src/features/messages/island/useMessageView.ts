import { useCallback, useState } from "react";
import type { MessageView } from "../Messages";
import type { MessageSource } from "../messagePreview";

export function useMessageView(closeMailReader: () => void, openIslandPage: (page: "qq") => void) {
  const [messageSource, setMessageSource] = useState<MessageView>("qq");

  const openMessages = useCallback((source: MessageSource) => {
    closeMailReader();
    setMessageSource(source);
    openIslandPage("qq");
  }, [closeMailReader, openIslandPage]);

  return { messageSource, setMessageSource, openMessages };
}
