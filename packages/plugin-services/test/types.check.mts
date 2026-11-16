import { RUST_METHODS, calendarV1, defineService, fileShelfV1, remindersV1, timersV1, translatorV1, type PlatformSupport, type RustMethods, type ServiceClient, type ServiceImpl, type ServiceProvider, type Timer } from "@fuyu/plugin-services";

declare const timers: ServiceClient<typeof timersV1>;
const listed: Promise<{ timers: Timer[]; at: number }> = timers.list();
void listed;
void timers.start({ kind: "countdown", durationMs: 60_000 });
void timers.start({ kind: "stopwatch" });
// @ts-expect-error a countdown needs its duration
void timers.start({ kind: "countdown" });
// @ts-expect-error pause needs the id
void timers.pause();
void timers.on("due", (data) => data.timer.id.length);
// @ts-expect-error the service declares no such event
void timers.on("tick", () => {});

declare const reminders: ServiceClient<typeof remindersV1>;
void reminders.push({ id: "due-1", source: "todos.due", icon: "flag", title: "Due today", detail: "Ship it" }).then((result) => result.shown);
// @ts-expect-error a reminder needs an icon the island knows
void reminders.push({ id: "x", source: "y", icon: "rocket", title: "z" });

declare const calendar: ServiceClient<typeof calendarV1>;
void calendar.events({}).then((result) => result.events.map((event) => event.meetingLink ?? event.title));
void calendar.events({ refresh: true }).then((result) => result.problems.map((problem) => problem.reason));
// @ts-expect-error refresh is a boolean
void calendar.events({ refresh: "yes" });
void calendar.sources().then((result) => result.sources.map((source) => (source.kind === "caldav" ? source.host : source.name)));

declare const shelf: ServiceClient<typeof fileShelfV1>;
void shelf.list().then((result) => result.items.map((item) => (item.missing ? item.name : item.path)));
void shelf.add({ paths: ["/tmp/shot.png"] }).then((result) => result.items.map((item) => item.addedAt + item.size));
// @ts-expect-error add needs the paths
void shelf.add({});

declare const translator: ServiceClient<typeof translatorV1>;
void translator.rewrite({ text: "hi", task: "polish" }, { onProgress: (chunk) => chunk.piece.length });
void translator.engines().then((result) => result.engines.map((entry) => entry.hasSecret));
// @ts-expect-error translate does not stream
void translator.translate({ text: "hi", direction: "auto" }, { onProgress: (chunk: string) => chunk });

const impl: ServiceImpl<typeof translatorV1> = {
  translate: ({ text }) => ({ text, engine: "deepseek" }),
  rewrite: async ({ text }, caller) => {
    caller.progress({ piece: text });
    return { text, engine: "openai" };
  },
  engines: () => ({ engines: [] }),
};
void impl;

declare const provider: ServiceProvider<typeof timersV1>;
provider.emit("changed", { timers: [], at: 0 });
// @ts-expect-error the payload of due is a timer, not a list
provider.emit("due", { timers: [], at: 0 });

type Echo = { echo(params: { text: string; count?: number }): { text: string } };
const echoV1 = defineService<Echo>("demo.echo/v1", { methods: { echo: true } });
void echoV1;

type Leaky = { open(): { close: () => void } };
// @ts-expect-error a method cannot return a function across the boundary
defineService<Leaky>("demo.leaky/v1", { methods: { open: true } });

type Incomplete = { a(): null; b(): null };
// @ts-expect-error every declared method must be listed
defineService<Incomplete>("demo.incomplete/v1", { methods: { a: true } });

type Streams = { run(params: { text: string }): null };
// @ts-expect-error a method with progress must say so
defineService<Streams, {}, { run: string }>("demo.streams/v1", { methods: { run: true } });
defineService<Streams, {}, { run: string }>("demo.streams/v1", { methods: { run: { progress: true } } });

type Clash = { on(): null };
// @ts-expect-error on is reserved for events
defineService<Clash>("demo.clash/v1", { methods: { on: true } });

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const supportShape: Same<PlatformSupport, { os: string; unsupported: Array<string>; devBuild: boolean }> = true;
const supportResult: Same<RustMethods["app.platformSupport"]["result"], PlatformSupport> = true;
const versionParams: RustMethods["app.version"]["params"] = null;
// @ts-expect-error app.echo needs its value
const echoParams: RustMethods["app.echo"]["params"] = {};
const marked: readonly string[] = RUST_METHODS;
// @ts-expect-error the list holds only the marked methods
const unmarked: (typeof RUST_METHODS)[number] = "app.nope";
void [supportShape, supportResult, versionParams, echoParams, marked, unmarked];
