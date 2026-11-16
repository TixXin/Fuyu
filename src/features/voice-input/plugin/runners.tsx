import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { todosIsland } from "../../todos/plugin/islandState";
import { useIslandVoiceInput } from "../useIslandVoiceInput";
import { voiceNotice } from "./islandState";

type RunnerProps = {
  openSettings: (section: "voiceInput") => void;
  takeClickFocus: () => Promise<void>;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function VoiceInputRunner({ openSettings, takeClickFocus }: RunnerProps) {
  const notice = useIslandVoiceInput(todosIsland.use(), { openSettings, takeClickFocus });
  voiceNotice.useProvide(notice);
  useIslandContributions("builtin", "voice-input.notice", notice ? [{ kind: "notice", item: "voice" }] : []);
  return null;
}

runnerSlot.add({ id: "voice-input.runner", component: VoiceInputRunner });
