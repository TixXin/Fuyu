import { builtinPlugins, subscribeBuiltinPlugins, switchBuiltinPlugin } from "../../plugin-kernel/builtinSwitches";
import { loadMigratedSwitches, saveMigratedSwitches } from "../../plugin-kernel/storage";
import { reconcileVoiceSwitch, type VoiceSwitchSeen } from "../settings";
import { VOICE_INPUT_SETTINGS_KEY, loadVoiceInputSettings, saveVoiceInputSettings } from "../storage";
import { VOICE_INPUT_CHANGED_EVENT } from "../useVoiceInputSettings";
import { OWNER } from "./owner.ts";

let seen: VoiceSwitchSeen | null = null;

function syncVoiceSwitch() {
  const plugins = builtinPlugins();
  const pluginOn = plugins?.find((plugin) => plugin.id === OWNER)?.enabled;
  const stored = loadVoiceInputSettings();
  const migrated = loadMigratedSwitches();
  const alreadyMigrated = migrated.has(VOICE_INPUT_SETTINGS_KEY);
  const result = reconcileVoiceSwitch(stored.enabled, pluginOn, alreadyMigrated ? seen : null, alreadyMigrated);
  if (!result) return;
  seen = result.seen;
  if (result.migrated) saveMigratedSwitches([...migrated, VOICE_INPUT_SETTINGS_KEY]);
  if (result.switchTo !== undefined) {
    seen = { stored: stored.enabled, switched: result.switchTo };
    void switchBuiltinPlugin(OWNER, result.switchTo).catch((error: unknown) => {
      console.error("Could not switch the voice-input plugin", error);
    });
  } else if (result.mirror !== undefined && pluginOn !== undefined) {
    seen = { stored: result.mirror, switched: pluginOn };
    saveVoiceInputSettings({ ...stored, enabled: result.mirror });
    window.dispatchEvent(new Event(VOICE_INPUT_CHANGED_EVENT));
  }
}

if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("window") === null) {
  subscribeBuiltinPlugins(syncVoiceSwitch);
  window.addEventListener("storage", (event) => {
    if (event.key === VOICE_INPUT_SETTINGS_KEY || event.key === null) syncVoiceSwitch();
  });
  window.addEventListener(VOICE_INPUT_CHANGED_EVENT, syncVoiceSwitch);
}
