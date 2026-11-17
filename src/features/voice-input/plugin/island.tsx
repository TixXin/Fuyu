import { defineSlot, type IslandNoticeMeta } from "../../plugin-kernel/slots";
import { voiceNotice } from "./islandState";
import { OWNER } from "./owner.ts";

const noticeSlot = defineSlot<object, IslandNoticeMeta<object>>("island.notice/v1");

function VoiceContent() {
  return voiceNotice.use()?.content;
}

function VoiceActions() {
  return voiceNotice.use()?.actions;
}

noticeSlot.add({ id: "voice", order: 20, component: VoiceContent, actions: VoiceActions }, OWNER);
