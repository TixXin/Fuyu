import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useIslandVoiceInput } from "../useIslandVoiceInput";
import { voiceNotice } from "./islandState";
import { OWNER } from "./owner.ts";
import "./voiceSwitch.ts";

type RunnerProps = {
  openSettings: (section: "voiceInput") => void;
  takeClickFocus: () => Promise<void>;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function VoiceInputRunner({ openSettings, takeClickFocus }: RunnerProps) {
  const notice = useIslandVoiceInput({ openSettings, takeClickFocus });
  voiceNotice.useProvide(notice);
  useIslandContributions(OWNER, "voice-input.notice", notice ? [{ kind: "notice", item: "voice" }] : []);
  return null;
}

runnerSlot.add({ id: "voice-input.runner", component: VoiceInputRunner }, OWNER);
