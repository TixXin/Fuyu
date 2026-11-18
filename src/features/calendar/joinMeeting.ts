import { mediaV1 } from "@fuyu/plugin-services";
import { windowServices } from "../plugin-kernel/services";
import { openMeetingLink } from "./api";

const media = windowServices.get(mediaV1);

export async function pausePlayingMedia(): Promise<boolean> {
  try {
    const state = await media.nowPlaying();
    if (state?.available && state.playing) {
      await media.playPause();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function joinCalendarMeeting(link: string, pauseMedia: boolean) {
  if (pauseMedia) void pausePlayingMedia();
  void openMeetingLink(link).catch((error: unknown) => console.error("Failed to open the meeting link", error));
}
