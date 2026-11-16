import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import { openMeetingLink } from "../api";
import { MeetingLine } from "../MeetingLine";
import { meetingState } from "./islandState";
import { OWNER } from "./owner.ts";

const lineSlot = defineSlot<object>("island.line/v1");

function UpcomingMeetingLine() {
  const meeting = meetingState.use();
  return meeting ? <MeetingLine meeting={meeting.upcoming} showTitle={meeting.showTitle} /> : null;
}

function JoinMeetingButton() {
  const t = useTranslation();
  const meeting = meetingState.use();
  const link = meeting?.upcoming.event.meetingLink;
  if (!link) return null;
  return (
    <button
      className="island-meeting-join"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void openMeetingLink(link).catch((error: unknown) => console.error("Failed to open the meeting link", error));
      }}
    >
      {t.calendar.join}
    </button>
  );
}

lineSlot.add({ id: "calendar.meeting", component: UpcomingMeetingLine }, OWNER);
lineSlot.add({ id: "calendar.join", component: JoinMeetingButton }, OWNER);
