import type { ReactNode } from "react";
import { defineSlot, type IslandNoticeMeta } from "../../plugin-kernel/slots";

type NoticeSources = { voice: { content: ReactNode; actions: ReactNode } | null };

const noticeSlot = defineSlot<NoticeSources, IslandNoticeMeta<NoticeSources>>("island.notice/v1");

function VoiceContent({ voice }: NoticeSources) {
  return voice?.content;
}

function VoiceActions({ voice }: NoticeSources) {
  return voice?.actions;
}

noticeSlot.add({ id: "voice", order: 20, active: ({ voice }) => voice !== null, component: VoiceContent, actions: VoiceActions });
