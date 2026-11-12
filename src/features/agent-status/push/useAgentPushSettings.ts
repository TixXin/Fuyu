import { useEffect, useState } from "react";
import { AGENT_PUSH_STORAGE_KEY, loadAgentPushSettings, saveAgentPushSettings, type AgentPushSettings } from "./storage";

export function useAgentPushSettings() {
  const [settings, setSettings] = useState<AgentPushSettings>(loadAgentPushSettings);

  useEffect(() => { saveAgentPushSettings(settings); }, [settings]);

  useEffect(() => {
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === AGENT_PUSH_STORAGE_KEY) setSettings(loadAgentPushSettings());
    };
    window.addEventListener("storage", syncFromOtherWindow);
    return () => window.removeEventListener("storage", syncFromOtherWindow);
  }, []);

  return [settings, setSettings] as const;
}
