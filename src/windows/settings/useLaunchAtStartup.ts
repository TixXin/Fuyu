import { useCallback, useEffect, useState } from "react";
import { readLaunchAtStartup, saveLaunchAtStartup } from "./api";

export function useLaunchAtStartup() {
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    void readLaunchAtStartup()
      .then(setLaunchAtStartup)
      .catch((error) => {
        console.error("Failed to read launch at startup", error);
      });
  }, []);

  const updateLaunchAtStartup = useCallback(async (enabled: boolean) => {
    setLaunchAtStartup(enabled);
    setError(null);

    try {
      await saveLaunchAtStartup(enabled);
    } catch (error) {
      console.error("Failed to update launch at startup", error);
      setLaunchAtStartup(!enabled);
      setError(error);
    }
  }, []);

  return [launchAtStartup, updateLaunchAtStartup, error] as const;
}
