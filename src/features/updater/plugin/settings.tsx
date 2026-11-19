import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { CommunitySection } from "../community/CommunitySection";
import { UpdateSettingsSection } from "../UpdateSettingsSection";
import { VersionHistory } from "../VersionHistory";
import { OWNER } from "./owner.ts";

function HistorySection() {
  return <VersionHistory />;
}

const sections = settingsSections<object, "about" | "aboutChangelog" | "aboutHelp">();

sections.add({ id: "about.updates", category: "about", order: 10, component: UpdateSettingsSection }, OWNER);
sections.add({ id: "about.history", category: "aboutChangelog", order: 20, component: HistorySection }, OWNER);
sections.add({ id: "about.community", category: "aboutHelp", order: 10, component: CommunitySection }, OWNER);
