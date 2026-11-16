import { useEffect, useLayoutEffect } from "react";
import { settingsRunners } from "../../plugin-kernel/settingsSlots";
import { onSectionFocus } from "../../../lib/settings/sectionFocus";
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

settingsRunners.add({ id: "todos.save-directory", component: SaveDirectoryRunner });
