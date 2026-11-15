import { useCallback, useEffect, useState } from "react";
import { readTrayIconVisible, saveTrayIconVisible } from "./api";

export function useTrayIconVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    void readTrayIconVisible()
      .then(setVisible)
      .catch((error) => {
        console.error("Failed to read the tray icon setting", error);
      });
  }, []);

  const update = useCallback(async (next: boolean) => {
    setVisible(next);
    try {
      await saveTrayIconVisible(next);
    } catch (error) {
      console.error("Failed to change the tray icon setting", error);
      setVisible(!next);
    }
  }, []);

  return [visible, update] as const;
}
