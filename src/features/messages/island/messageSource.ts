import type { MessageSource } from "../messagePreview";

const SOURCES: readonly MessageSource[] = ["qq", "wechat", "qqMail"];

export function resolveMessageSource(source: MessageSource, enabled: Readonly<Record<MessageSource, boolean>>): MessageSource {
  if (enabled[source]) return source;
  return SOURCES.find((candidate) => enabled[candidate]) ?? source;
}
