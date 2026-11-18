import { settingsRunners } from "../../../features/plugin-kernel/settingsSlots";
import { PluginShortcutOwners } from "../PluginShortcutOwners";
import { PluginV3ShortcutOwners } from "../PluginV3ShortcutOwners";

settingsRunners.add({ id: "plugins-v3.shortcut-owners", component: PluginV3ShortcutOwners });
settingsRunners.add({ id: "plugins.shortcut-owners", component: PluginShortcutOwners });
