import { useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "../../i18n";
import { listenUpdateNotificationClick } from "./api";
import { nextUpdateCheckAt } from "./checkSchedule";
import {
  checkInBackground, getUpdateState, notifyAvailableUpdate, reminderVersion, subscribeToUpdate,
} from "./updaterController";

export function useBackgroundUpdateCheck(onOpen: () => void) {
  const text = useTranslation().settings.project.update;
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenUpdateNotificationClick(onOpen).then((stop) => {
      if (disposed) stop(); else unlisten = stop;
    }).catch((error) => console.error("Failed to listen for update notifications", error));
    return () => { disposed = true; unlisten?.(); };
  }, [onOpen]);
  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    let running = false;
    const arm = () => {
      window.clearTimeout(timer);
      if (stopped || running || !navigator.onLine) return;
      const deadline = nextUpdateCheckAt(getUpdateState());
      if (deadline === null) return;
      timer = window.setTimeout(() => {
        if (deadline > Date.now()) { arm(); return; }
        running = true;
        void checkInBackground().then(async (checked) => {
          if (checked && !stopped) await notifyAvailableUpdate(text.notificationTitle, text.notificationBody);
        }).finally(() => { running = false; arm(); });
      }, Math.max(0, Math.min(deadline - Date.now(), 60_000)));
    };
    const unsubscribe = subscribeToUpdate(arm);
    window.addEventListener("online", arm);
    window.addEventListener("offline", arm);
    window.addEventListener("focus", arm);
    document.addEventListener("visibilitychange", arm);
    arm();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("online", arm);
      window.removeEventListener("offline", arm);
      window.removeEventListener("focus", arm);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [text]);
}

export function useUpdateReminder() {
  return useSyncExternalStore(subscribeToUpdate, () => reminderVersion(getUpdateState()));
}
