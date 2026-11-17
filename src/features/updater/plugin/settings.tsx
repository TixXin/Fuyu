import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { UpdateSettingsSection } from "../UpdateSettingsSection";
import { VersionHistory } from "../VersionHistory";
import { OWNER } from "./owner.ts";

function HistorySection() {
  return <VersionHistory />;
}

const sections = settingsSections<object, "about">();

sections.add({ id: "about.updates", category: "about", order: 10, component: UpdateSettingsSection }, OWNER);
sections.add({ id: "about.history", category: "about", order: 20, component: HistorySection }, OWNER);
