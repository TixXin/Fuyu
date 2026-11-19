import { isMacOS } from "../../lib/platform";

export const PLUGIN_BASE = isMacOS ? "fuyu-plugin://localhost" : "http://fuyu-plugin.localhost";
