import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import { openMeetingLink } from "../api";
import { MeetingLine } from "../MeetingLine";
import type { CollapsedMeeting } from "../upcoming";
import { OWNER } from "./owner.ts";

type LineContext = {
  meeting: CollapsedMeeting | null;
};

const lineSlot = defineSlot<LineContext>("island.line/v1");

function UpcomingMeetingLine({ meeting }: LineContext) {
  return meeting ? <MeetingLine meeting={meeting.upcoming} showTitle={meeting.showTitle} /> : null;
}

function JoinMeetingButton({ meeting }: LineContext) {
  const t = useTranslation();
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
