import type { IslandNotice } from "../../../lib/island-notices/service";

type Listener = (notice: IslandNotice) => boolean;

const listeners = new Set<Listener>();
let sendAction: ((pluginId: string, action: string) => void) | null = null;

export function deliverNotice(notice: IslandNotice): boolean {
  let shown = false;
  for (const listener of [...listeners]) shown = listener(notice) || shown;
  return shown;
}

export function onNotice(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setNoticeActionSender(send: ((pluginId: string, action: string) => void) | null) {
  sendAction = send;
}

export function runNoticeAction(pluginId: string, action: string) {
  sendAction?.(pluginId, action);
}
