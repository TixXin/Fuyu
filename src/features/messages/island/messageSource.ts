import { IM_SOURCE_IDS } from "../im-sources/imSourcesState.ts";
import type { MessageSource } from "../messagePreview.ts";

const SOURCES: readonly MessageSource[] = ["qq", "wechat", "qqMail", ...IM_SOURCE_IDS];

export function resolveMessageSource(source: MessageSource, enabled: Partial<Readonly<Record<MessageSource, boolean>>>): MessageSource {
  if (enabled[source]) return source;
  return SOURCES.find((candidate) => enabled[candidate]) ?? source;
}
