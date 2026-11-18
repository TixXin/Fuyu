import type { ServiceDefinition } from "../define.mjs";
import type { ClipboardTexts } from "../generated/rust.mjs";

export type { ClipboardText, ClipboardTexts } from "../generated/rust.mjs";

export type ClipboardMethods = {
  history(params: { limit?: number }): ClipboardTexts;
  copyText(params: { text: string }): { ok: true };
  pasteText(params: { text: string; enter?: boolean }): { ok: true };
};

export const clipboardV1: ServiceDefinition<ClipboardMethods, {}, {}>;
