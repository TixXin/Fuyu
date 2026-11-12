import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { openProjectLink } from "./api";

export function useOpenInBrowser() {
  const [failed, setFailed] = useState(false);

  const open = async (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!isTauri()) return;

    event.preventDefault();
    setFailed(false);
    try {
      await openProjectLink(event.currentTarget.href);
    } catch (error) {
      console.error("Failed to open project link", error);
      setFailed(true);
    }
  };

  return { failed, onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void open(event) };
}
