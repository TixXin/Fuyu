import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Click handler for a link to a project page: in the app the system browser opens
 * it (a WebView link would open inside the settings window); in a plain browser
 * the link behaves as usual. `failed` is true when the browser could not be opened.
 */
export function useOpenInBrowser() {
  const [failed, setFailed] = useState(false);

  const open = async (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!isTauri()) return;

    event.preventDefault();
    setFailed(false);
    try {
      await openUrl(event.currentTarget.href);
    } catch (error) {
      console.error("Failed to open project link", error);
      setFailed(true);
    }
  };

  return { failed, onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void open(event) };
}
