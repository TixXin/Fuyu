import { remindersV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { readReminder } from "../reminderParams";
import { pushIslandReminder } from "../reminders";
import { OWNER } from "./owner.ts";

if (new URLSearchParams(window.location.search).get("window") === null) {
  windowServices.provide(remindersV1, {
    push: (params) => {
      const reminder = readReminder(params);
      if (!reminder) throw Object.assign(new Error("a reminder needs an id, a source, a known icon and a title"), { code: "bad-params" });
      pushIslandReminder(reminder);
      return { shown: true };
    },
  }, { owner: OWNER });
}
