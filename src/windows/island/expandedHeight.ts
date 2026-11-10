import { AGENT_POPUP_LIST_SAVING, getAgentAlertExpandedHeight, POPUP_HEADER_SAVING } from "./layout.ts";
import type { IslandPage } from "./types";

// The island around the new-messages rows: top padding, header and gap (66) and bottom padding (20).
const MESSAGE_ARRIVALS_CHROME_HEIGHT = 86;

type ExpandedHeightInput = {
  page: IslandPage;
  /** The panel height setting: every page is this tall and scrolls inside (C27). */
  maxPanelHeight: number;
  /** An Agent alert's or request's one-session card: the height its row measured. */
  agentAlertRowHeight?: number;
  /** The Messages page showing only new messages (roadmap C11): the height its rows measured. */
  messageArrivalsHeight?: number;
  /** A popup (the two above, without an approval card) shows no header (C11b). */
  popup?: boolean;
};

/**
 * Height of the expanded island. Every page is as tall as the panel height setting and scrolls
 * inside it (C27, the user's call: one width and height for all pages); only the cards that open
 * by themselves (new messages, an Agent alert or request) fit what they hold.
 */
export function getExpandedIslandHeight({ page, maxPanelHeight, agentAlertRowHeight, messageArrivalsHeight, popup = false }: ExpandedHeightInput) {
  const height = page === "agents" && agentAlertRowHeight !== undefined
    ? getAgentAlertExpandedHeight(agentAlertRowHeight)
    : page === "qq" && messageArrivalsHeight !== undefined
      ? Math.min(MESSAGE_ARRIVALS_CHROME_HEIGHT + messageArrivalsHeight, maxPanelHeight)
      : maxPanelHeight;
  return popup ? height - POPUP_HEADER_SAVING - (page === "agents" ? AGENT_POPUP_LIST_SAVING : 0) : height;
}
