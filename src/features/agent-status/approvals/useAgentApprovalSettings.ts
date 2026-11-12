import { useEffect, useState } from "react";
import { AGENT_APPROVAL_STORAGE_KEY, loadAgentApprovalSettings, saveAgentApprovalSettings, type AgentApprovalSettings } from "./storage";

export function useAgentApprovalSettings() {
  const [settings, setSettings] = useState<AgentApprovalSettings>(loadAgentApprovalSettings);

  useEffect(() => { saveAgentApprovalSettings(settings); }, [settings]);

  useEffect(() => {
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === AGENT_APPROVAL_STORAGE_KEY) setSettings(loadAgentApprovalSettings());
    };
    window.addEventListener("storage", syncFromOtherWindow);
    return () => window.removeEventListener("storage", syncFromOtherWindow);
  }, []);

  return [settings, setSettings] as const;
}
