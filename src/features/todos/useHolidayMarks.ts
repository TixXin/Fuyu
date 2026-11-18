import { useEffect, useState } from "react";
import { calendarV1 } from "@fuyu/plugin-services";
import { buildHolidayMarkMap, type HolidayDayMark } from "../../utils/workday.ts";
import { windowServices } from "../plugin-kernel/services";

const EMPTY_MARKS: ReadonlyMap<string, HolidayDayMark> = new Map();

export function useHolidayMarks(): ReadonlyMap<string, HolidayDayMark> {
  const [marks, setMarks] = useState<ReadonlyMap<string, HolidayDayMark>>(EMPTY_MARKS);

  useEffect(() => {
    let disposed = false;

    const refresh = async () => {
      if (!windowServices.has(calendarV1.name)) return;
      try {
        const result = await windowServices.get(calendarV1).events({ refresh: false });
        if (!disposed && result && Array.isArray(result.events)) {
          setMarks(buildHolidayMarkMap(result.events));
        }
      } catch {
        if (!disposed) setMarks(EMPTY_MARKS);
      }
    };

    void refresh();
    const stopService = windowServices.watch(() => {
      void refresh();
    });
    const stopEvents = windowServices.get(calendarV1).on("changed", () => {
      void refresh();
    });

    return () => {
      disposed = true;
      stopService();
      void stopEvents();
    };
  }, []);

  return marks;
}
