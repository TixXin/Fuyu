import { useEffect, useLayoutEffect } from "react";
import { runnerSlot } from "../../../windows/settings/slots/runnerSlot";
import { onSectionFocus } from "../../../windows/settings/sectionFocus";
import { useSaveDirectorySetting } from "../useSaveDirectorySetting";
import { announceSaveDirectorySetting, holdSaveDirectorySetting } from "../saveDirectoryStore";

function SaveDirectoryRunner() {
  const saveDirectory = useSaveDirectorySetting();
  const { highlight } = saveDirectory;
  holdSaveDirectorySetting(saveDirectory);
  useLayoutEffect(() => {
    holdSaveDirectorySetting(saveDirectory);
    announceSaveDirectorySetting();
    return () => {
      holdSaveDirectorySetting(null);
      announceSaveDirectorySetting();
    };
  }, [saveDirectory]);
  useEffect(() => onSectionFocus((section) => {
    if (section === "savePath") highlight();
  }), [highlight]);
  return null;
}

runnerSlot.add({ id: "todos.save-directory", component: SaveDirectoryRunner });
