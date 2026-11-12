import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const LOCAL_API_REQUEST_EVENT = "local-api-request";

export type LocalApiRequest = {
  id: number;
  method: string;
  params: unknown;
};

export type LocalApiResponse =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

export function answerLocalApiRequest(id: number, response: LocalApiResponse) {
  return invoke<void>("answer_local_api_request", { id, response });
}

export function listenLocalApiRequests(handler: (request: LocalApiRequest) => void) {
  return listen<LocalApiRequest>(LOCAL_API_REQUEST_EVENT, (event) => handler(event.payload));
}
