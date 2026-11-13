import durations from "../../../assets/voice/003-messages/durations.json";
import type { Director } from "../../stage/director";
import { island } from "../../stage/island";
import { sound } from "../../stage/sound";
import { SCREEN_HEIGHT, STAGE_WIDTH, ZOOM, moveCamera, showCaption, stage } from "../../stage/stageState";
import type { Lang } from "../types";
import { copyFor, type Copy } from "./copy";
import narration from "./narration.json";

type Line = keyof typeof narration.zh;
const LINES: Line[] = ["l1", "l2", "l3", "l4", "l5", "l6"];
const GAP = 450;
const LEAD = 700;
const TAIL = 1800;

export function beats(lang: Lang) {
  const starts = {} as Record<Line, number>;
  let at = LEAD;
  for (const line of LINES) {
    starts[line] = at;
    at += durations[lang][line] + GAP;
  }
  return { starts, total: at - GAP + TAIL };
}

function moveCursor(x: number, y: number, ms: number) {
  stage.set((current) => ({ cursor: { ...current.cursor, x, y, ms, visible: true } }));
}

async function qqArrives(copy: Copy) {
  const world = island.world();
  world.qq = { ...world.qq, revision: world.qq.revision + 1, items: [{ id: "q1", title: copy.qq.title, body: copy.qq.body, createdAt: Date.now() }] };
  await island.emit("qq-notifications-changed", { snapshot: world.qq, newestId: "q1", windowVisible: true });
}

async function wechatArrives(copy: Copy) {
  const world = island.world();
  const message = { ...copy.wechat, unread: 2, at: Date.now() };
  world.wechat = {
    ...world.wechat, revision: world.wechat.revision + 1, pending: true, lastAttentionAt: Date.now(), message,
    items: [{ at: Date.now(), message, reason: null }],
  };
  await island.emit("wechat-reminder-changed", { snapshot: world.wechat, windowVisible: true });
}

async function mailArrives(copy: Copy) {
  const world = island.world();
  world.mail = {
    ...world.mail, revision: world.mail.revision + 1, unreadCount: 1,
    items: [{ id: "m1", uid: 1, sender: copy.mail.sender, subject: copy.mail.subject, unread: true, receivedAt: Date.now() }],
  };
  await island.emit("qq-mail-changed", { snapshot: world.mail, newestId: "m1", windowVisible: true });
}

export function script(director: Director, lang: Lang) {
  const copy = copyFor(lang);
  const { at } = director;
  const { starts } = beats(lang);
  const say = (line: Line) => at(starts[line], () => {
    sound(`voice:${line}`);
    showCaption("", narration[lang][line]);
  });
  LINES.forEach(say);

  at(0, () => stage.set({ title: copy.title }));
  at(250, () => stage.set({ scene: "busy" }));
  at(starts.l1 + 900, () => moveCursor(STAGE_WIDTH / 2 + 70, SCREEN_HEIGHT - 60, 1100));

  at(starts.l2, () => moveCursor(STAGE_WIDTH / 2 + 30, 110, 1300));
  at(starts.l2 + 200, () => moveCamera(ZOOM.bar, 1300));

  at(starts.l3 - 150, () => moveCamera(ZOOM.popup, 800));
  at(starts.l3 + 150, () => qqArrives(copy));
  at(starts.l3 + 1350, () => wechatArrives(copy));
  at(starts.l3 + 2550, () => mailArrives(copy));

  at(starts.l4 + 100, () => island.click(".message-arrivals__row", 0, 650));
  at(starts.l4 + 350, () => moveCamera(ZOOM.panel, 900));

  at(starts.l5 + 300, () => island.click(".island__collapse-target", 0, 600));
  at(starts.l5 + 1100, () => {
    island.hideCursor();
    stage.set({ scene: "calm" });
    moveCamera(1, 1300);
  });

  at(starts.l6, () => stage.set({ dim: 0.86, endCard: true, title: "" }));
}
