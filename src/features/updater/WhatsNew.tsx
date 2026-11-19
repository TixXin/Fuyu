import { useSyncExternalStore } from "react";
import { getUpdateState, subscribeToUpdate } from "./updaterController";
import { UpdateNotes } from "./UpdateNotes";
import "./UpdatePanel.css";

export function WhatsNew() {
  const { stage, notes, nextVersion } = useSyncExternalStore(subscribeToUpdate, getUpdateState);
  if (stage !== "available" && stage !== "ready" && stage !== "downloading") return null;
  return (
    <div className="about-whats-new">
      <UpdateNotes notes={notes} version={nextVersion} />
    </div>
  );
}
