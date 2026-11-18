import { agentsV1 } from "./services/agents.mjs";
import { calendarV1 } from "./services/calendar.mjs";
import { clipboardV1 } from "./services/clipboard.mjs";
import { fileShelfV1 } from "./services/fileShelf.mjs";
import { lyricsV1 } from "./services/lyrics.mjs";
import { marketV1 } from "./services/market.mjs";
import { mediaV1 } from "./services/media.mjs";
import { messagesV1 } from "./services/messages.mjs";
import { remindersV1 } from "./services/reminders.mjs";
import { timersV1 } from "./services/timers.mjs";
import { todosV1 } from "./services/todos.mjs";
import { translatorV1 } from "./services/translator.mjs";

export { DEFAULT_TIMEOUT_MS, MEMBER_NAME, SERVICE_NAME, defineService, isServiceDefinition } from "./define.mjs";
export { agentsV1, calendarV1, clipboardV1, fileShelfV1, lyricsV1, marketV1, mediaV1, messagesV1, remindersV1, timersV1, todosV1, translatorV1 };
export { RUST_METHODS } from "./generated/rust.mjs";
export const SERVICES = Object.freeze([agentsV1.name, calendarV1.name, clipboardV1.name, fileShelfV1.name, lyricsV1.name, marketV1.name, mediaV1.name, messagesV1.name, remindersV1.name, timersV1.name, todosV1.name, translatorV1.name]);
