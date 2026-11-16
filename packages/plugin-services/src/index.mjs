import { calendarV1 } from "./services/calendar.mjs";
import { clipboardV1 } from "./services/clipboard.mjs";
import { fileShelfV1 } from "./services/fileShelf.mjs";
import { mediaV1 } from "./services/media.mjs";
import { remindersV1 } from "./services/reminders.mjs";
import { timersV1 } from "./services/timers.mjs";
import { translatorV1 } from "./services/translator.mjs";

export { DEFAULT_TIMEOUT_MS, MEMBER_NAME, SERVICE_NAME, defineService, isServiceDefinition } from "./define.mjs";
export { calendarV1, clipboardV1, fileShelfV1, mediaV1, remindersV1, timersV1, translatorV1 };
export { RUST_METHODS } from "./generated/rust.mjs";
export const SERVICES = Object.freeze([calendarV1.name, clipboardV1.name, fileShelfV1.name, mediaV1.name, remindersV1.name, timersV1.name, translatorV1.name]);
