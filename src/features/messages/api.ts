import { emit, listen } from "@tauri-apps/api/event";

export const MESSAGE_SAMPLE_REQUESTED_EVENT = "message-sample-requested";

export function requestMessageSample() {
  return emit(MESSAGE_SAMPLE_REQUESTED_EVENT);
}

export function listenMessageSampleRequested(handler: () => void) {
  return listen(MESSAGE_SAMPLE_REQUESTED_EVENT, () => handler());
}
