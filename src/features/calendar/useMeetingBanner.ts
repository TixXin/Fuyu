import { remindersV1 } from "@fuyu/plugin-services";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { windowServices } from "../plugin-kernel/services";
import type { CalendarEvent } from "./api";
import type { CalendarPrefs } from "./calendarPrefs";
import { dueMeetingBanner, formatMeetingBanner, type MeetingBannerPayload } from "./upcoming";

const reminders = windowServices.get(remindersV1);

type ActiveBanner = {
  payload: MeetingBannerPayload;
  endMs: number;
};

export type MeetingBannerState = {
  banner: MeetingBannerPayload;
  pauseMediaOnJoin: boolean;
  dismiss: () => void;
};

export function useMeetingBanner(
  enabled: boolean,
  events: readonly CalendarEvent[],
  now: number,
  prefs: CalendarPrefs,
  showTitle: boolean,
): MeetingBannerState | null {
  const text = useTranslation().calendar;
  const remindedRef = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<ActiveBanner | null>(null);

  useEffect(() => {
    if (!enabled || !prefs.bannerEnabled) {
      setActive(null);
      return;
    }
    if (active && now >= active.endMs) {
      setActive(null);
    }
    const due = dueMeetingBanner(events, now, prefs, remindedRef.current);
    if (!due) return;
    remindedRef.current.add(due.id);
    const payload = formatMeetingBanner(due, showTitle, text);
    if (payload.meetingLink) {
      setActive({ payload, endMs: due.event.endMs });
      return;
    }
    void reminders
      .push({
        id: payload.id,
        source: payload.source,
        icon: payload.icon,
        title: payload.title,
        detail: payload.detail,
        snoozable: true,
      })
      .catch(() => {
        setActive({ payload, endMs: due.event.endMs });
      });
  }, [active, enabled, events, now, prefs, showTitle, text]);

  const dismiss = useCallback(() => setActive(null), []);

  return useMemo(
    () => (enabled && prefs.bannerEnabled && active ? { banner: active.payload, pauseMediaOnJoin: prefs.pauseMediaOnJoin, dismiss } : null),
    [active, dismiss, enabled, prefs.bannerEnabled, prefs.pauseMediaOnJoin],
  );
}
