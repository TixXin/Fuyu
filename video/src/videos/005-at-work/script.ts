import type { GlassLookId } from "../../../../src/lib/theme/glassLooks";
import type { Director } from "../../stage/director";
import { island } from "../../stage/island";
import { sound } from "../../stage/sound";
import { ZOOM, hideCaption, moveCamera, showCaption, stage } from "../../stage/stageState";
import type { Lang } from "../types";
import {
  applySettings, frameWindow, glass, hideStageCursor, hover, islandHovered, mailArrives, messagesArrive, nativeTip, patchSession,
  pluginsShown, questionArrives, settingsClick, settingsPoint, shake, startMusic, stopMusic, unhover,
} from "./actions";
import { BEAT } from "./beats";
import { copyFor, type Copy } from "./copy";
import { TERMINALS } from "./desktop";
import { wordTimes } from "./music";
import { addLine, hideCard, scene, showCard } from "./state";

const GLASS_ORDER: GlassLookId[] = ["flow", "tinted", "clear", "material", "mica"];

const VOICE: [string, number][] = [
  ["l1", 400], ["l2", BEAT.agents], ["l3", BEAT.alerts], ["l4", BEAT.question + 400], ["l5", BEAT.jump + 500],
  ["l6", BEAT.away + 600], ["l7", BEAT.messages + 300], ["l8", BEAT.meeting], ["l9", BEAT.note + 500],
  ["l10", BEAT.music + 800], ["l11", BEAT.look + 1900], ["l12", BEAT.edge + 900], ["l13", BEAT.plugins + 2000],
  ["l14", BEAT.plugins + 15800], ["l15", BEAT.end + 300],
];

function fillTerminals(copy: Copy, from: number, at: Director["at"]) {
  TERMINALS.forEach((term, index) => {
    copy.terminals[term.id].forEach((line, row) => at(from + index * 140 + row * 520, () => addLine(term.id, line)));
  });
}

function sessionIndex(title: string) {
  const rows = [...frameWindow().document.querySelectorAll<HTMLElement>(".agent-card")];
  return Math.max(0, rows.findIndex((row) => row.textContent?.includes(title)));
}

export function script(director: Director, lang: Lang) {
  const copy = copyFor(lang);
  const { at } = director;
  const caption = (pair: string[]) => showCaption(pair[0], pair[1]);
  VOICE.forEach(([line, ms]) => at(ms, () => sound(`voice:${line}`)));

  at(BEAT.desk - 700, () => scene.set({ cover: "out" }));
  at(BEAT.desk, () => scene.set({ cover: "hidden" }));
  fillTerminals(copy, 600, at);
  at(BEAT.gather, () => scene.set({ gather: true }));
  at(BEAT.gather + 700, () => {
    sound("start");
    stage.set({ islandVisible: true, scene: "busy" });
  });
  at(BEAT.gather + 1400, () => scene.set({ gather: false }));

  at(BEAT.agents, () => caption(copy.captions.watch));
  at(BEAT.agents + 200, () => moveCamera(ZOOM.bar, 1100));

  at(BEAT.hover - 200, hideCaption);
  at(BEAT.hover, () => caption(copy.captions.hover));
  at(BEAT.hover + 200, () => hover(".session-ring", 0, 600));
  at(BEAT.hover + 2000, () => unhover(".session-ring"));
  at(BEAT.hover + 2100, () => hover(".claude-usage-gauge", 0, 400));
  at(BEAT.hover + 3500, () => unhover(".claude-usage-gauge", 0));
  at(BEAT.hover + 3600, () => hover(".claude-usage-gauge", 1, 300));
  at(BEAT.hover + 4900, () => {
    unhover(".claude-usage-gauge", 1);
    hideStageCursor();
  });

  at(BEAT.alerts - 200, hideCaption);
  at(BEAT.alerts, () => caption(copy.captions.alerts));
  at(BEAT.alerts + 300, () => {
    sound("complete");
    patchSession("s2", { phase: "completed", currentTool: null });
  });
  at(BEAT.alerts + 1700, () => patchSession("s5", { phase: "failed", currentTool: null, lastMessage: copy.terminals.kimiCode[2][1].trim() }));
  at(BEAT.alerts + 3100, () => patchSession("s4", { phase: "waiting", currentTool: null, lastMessage: copy.sessions[3].ask }));

  at(BEAT.question - 200, hideCaption);
  at(BEAT.question, () => questionArrives(copy));
  at(BEAT.question + 200, () => moveCamera(ZOOM.panel, 900));
  at(BEAT.question + 400, () => caption(copy.captions.question));
  at(BEAT.question + 2400, () => island.click(".agent-question__option", 0, 700));
  at(BEAT.question + 3200, () => {
    sound("ack");
    patchSession("s1", { phase: "running", currentTool: { name: "Bash", detail: "gh pr create" } });
  });

  at(BEAT.jump - 200, hideCaption);
  at(BEAT.jump, () => island.click(".island__open-button", 0, 400));
  at(BEAT.jump + 500, () => caption(copy.captions.archive));
  at(BEAT.jump + 1300, () => island.click(".agent-session__archive", sessionIndex(copy.sessions[1].title), 700));
  at(BEAT.jump + 2600, () => caption(copy.captions.jump));
  at(BEAT.jump + 3600, () => island.click(".agent-card", sessionIndex(copy.sessions[4].title), 700));
  at(BEAT.jump + 4500, () => {
    void island.click(".island__collapse-target", 0, 300);
    moveCamera(1, 900);
    scene.set({ ring: "kimiCode" });
  });
  at(BEAT.jump + 5000, () => scene.set({ focus: "kimiCode" }));
  at(BEAT.jump + 6300, () => {
    hideStageCursor();
    scene.set({ focus: null, ring: null });
  });

  at(BEAT.away - 300, hideCaption);
  at(BEAT.away, () => {
    scene.set({ away: true });
    patchSession("s1", { phase: "completed", currentTool: null });
  });
  at(BEAT.away + 600, () => {
    caption(copy.captions.away);
    scene.set({ phone: "push" });
  });
  at(BEAT.away + 3300, () => scene.set({ phone: "chat" }));
  at(BEAT.away + 3600, () => caption(copy.captions.reply));
  at(BEAT.away + 4300, () => scene.set({ chat: [{ from: "me", text: copy.phone.reply }] }));
  at(BEAT.away + 5500, () => scene.set((current) => ({ chat: [...current.chat, { from: "bot", text: copy.phone.ack }] })));
  at(BEAT.away + 6900, () => scene.set((current) => ({ chat: [...current.chat, { from: "bot", text: copy.phone.done }] })));

  at(BEAT.messages - 300, hideCaption);
  at(BEAT.messages, () => {
    scene.set({ phone: "hidden", away: false });
    moveCamera(ZOOM.popup, 900);
  });
  at(BEAT.messages + 300, () => caption(copy.captions.messages));
  at(BEAT.messages + 400, () => messagesArrive(copy));
  at(BEAT.messages + 4600, () => caption(copy.captions.open));
  at(BEAT.messages + 4800, () => island.click(".message-arrivals__clear", 0, 700));
  at(BEAT.messages + 6000, () => mailArrives(copy));
  at(BEAT.messages + 7200, () => island.click(".message-arrivals__row", 0, 600));
  at(BEAT.messages + 7800, () => moveCamera(ZOOM.panel, 800));

  at(BEAT.meeting - 600, () => island.click(".island__collapse-target", 0, 400));
  at(BEAT.meeting - 100, () => {
    hideCaption();
    hideStageCursor();
  });
  at(BEAT.meeting, () => {
    caption(copy.captions.meeting);
    moveCamera(ZOOM.bar, 900);
  });
  at(BEAT.meeting + 1800, () => island.click(".island-meeting-join", 0, 800));
  at(BEAT.meeting + 3400, () => applySettings({ calendarRemindMinutes: 0 }));

  at(BEAT.note - 300, hideCaption);
  at(BEAT.note, () => island.click(".island__open-button", 0, 600));
  at(BEAT.note + 200, () => moveCamera(ZOOM.panel, 900));
  at(BEAT.note + 500, () => caption(copy.captions.note));
  at(BEAT.note + 900, () => island.click(".dot-button--todo", 0, 500));
  at(BEAT.note + 1800, () => island.click(".todo-island-row__check", 0, 500));
  at(BEAT.note + 2900, () => island.click(".todo-island__tab", 1, 500));
  at(BEAT.note + 3600, () => island.type(".todo-island__note", copy.note, 60));

  at(BEAT.collapse - 300, hideCaption);
  at(BEAT.collapse, () => island.click(".island__collapse-target", 0, 500));
  at(BEAT.collapse + 600, () => {
    applySettings({ expandTrigger: "hover" });
    moveCamera(ZOOM.panel, 900);
    stage.set((current) => ({ cursor: { ...current.cursor, x: current.cursor.x + 260, y: current.cursor.y + 180, ms: 500 } }));
  });
  at(BEAT.collapse + 900, () => caption(copy.captions.collapse));
  at(BEAT.collapse + 1400, () => island.pointAt(".island", 0, 600));
  at(BEAT.collapse + 1800, () => islandHovered(false));
  at(BEAT.collapse + 2000, () => islandHovered(true));
  at(BEAT.collapse + 3400, () => stage.set((current) => ({ cursor: { ...current.cursor, x: current.cursor.x + 200, y: current.cursor.y + 330, ms: 700 } })));
  at(BEAT.collapse + 3700, () => islandHovered(false));
  at(BEAT.collapse + 4400, () => applySettings({ expandTrigger: "click" }));

  at(BEAT.music - 200, hideCaption);
  at(BEAT.music, () => island.click(".island__open-button", 0, 500));
  at(BEAT.music + 500, () => island.click(".dot-button--music", 0, 500));
  at(BEAT.music + 600, () => startMusic(copy));
  at(BEAT.music + 800, () => caption(copy.captions.music));
  at(BEAT.music + 2300, () => {
    void island.click(".island__collapse-target", 0, 400);
    moveCamera(ZOOM.bar, 900);
  });
  at(BEAT.music + 2900, () => {
    hideStageCursor();
    shake(wordTimes(copy).map((time) => BEAT.music + 600 + time).filter((time) => time > BEAT.music + 2900), BEAT.music + 2900);
  });

  at(BEAT.look - 300, () => {
    hideCaption();
    void stopMusic();
    moveCamera(ZOOM.panel, 900);
  });
  at(BEAT.look, () => {
    void island.click(".island__open-button", 0, 400);
    showCard(copy.chapters.look, false);
  });
  at(BEAT.look + 500, () => island.click(".island__agent-button", 0, 400));
  at(BEAT.look + 1800, () => {
    hideCard();
    hideStageCursor();
  });
  at(BEAT.look + 1900, () => caption(copy.captions.theme));
  at(BEAT.look + 2200, () => applySettings({ themeMode: "light" }));
  at(BEAT.look + 3600, () => applySettings({ themeMode: "dark" }));
  GLASS_ORDER.forEach((look, index) => at(BEAT.look + 4900 + index * 1300, () => {
    showCaption(copy.captions.glass[0], copy.captions.glassLooks[look]);
    glass(look);
  }));

  at(BEAT.edge - 300, () => {
    hideCaption();
    applySettings({ appearanceMode: "classic" });
  });
  at(BEAT.edge, () => island.click(".island__collapse-target", 0, 600));
  at(BEAT.edge + 600, () => moveCamera(1, 900));
  at(BEAT.edge + 900, () => caption(copy.captions.edge));
  at(BEAT.edge + 1200, () => island.pointAt(".island", 0, 500));
  const shiftTo = (x: number, y: number, ms: number, pressed: boolean) =>
    stage.set((current) => ({ islandShift: { x, y, ms }, cursor: { ...current.cursor, x: current.cursor.x + x - current.islandShift.x, y: current.cursor.y + y - current.islandShift.y, ms, pressed } }));
  const drag = (from: number, [x0, y0]: number[], [x1, y1]: number[], ms: number) => {
    const steps = Math.round(ms / 120);
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      at(from + step * 120, () => shiftTo(x0 + (x1 - x0) * ease, y0 + (y1 - y0) * ease, 130, true));
    }
  };
  at(BEAT.edge + 1900, () => {
    shiftTo(0, 0, 0, true);
    void island.emit("island-position-changed", { x: 400, y: 260 });
  });
  drag(BEAT.edge + 2000, [0, 0], [-120, 240], 1200);
  drag(BEAT.edge + 3700, [-120, 240], [-380, 260], 840);
  at(BEAT.edge + 4700, () => {
    stage.set((current) => ({ islandShift: { x: -230, y: 200, ms: 1000 }, cursor: { ...current.cursor, pressed: false } }));
    void island.emit("island-position-cleared", null);
    void island.emit("island-edge-changed", "left");
  });

  at(BEAT.plugins - 300, () => {
    hideCaption();
    hideStageCursor();
    void island.emit("island-edge-changed", "top");
    stage.set({ islandShift: { x: 0, y: 0, ms: 600 } });
  });
  at(BEAT.plugins, () => showCard(copy.chapters.plugins, true));
  at(BEAT.plugins + 1800, () => {
    hideCard();
    void pluginsShown(copy, false);
    scene.set((current) => ({ focus: "claudeCode", terms: { ...current.terms, claudeCode: [] } }));
  });
  at(BEAT.plugins + 2000, () => caption(copy.captions.ask));
  at(BEAT.plugins + 2400, () => addLine("claudeCode", ["prompt", copy.plugin.ask]));
  at(BEAT.plugins + 3800, () => caption(copy.captions.write));
  copy.plugin.files.forEach((line, row) => at(BEAT.plugins + 4000 + row * 650, () => addLine("claudeCode", line)));
  at(BEAT.plugins + 8300, () => caption(copy.captions.submit));
  at(BEAT.plugins + 8400, () => scene.set({ pr: "open" }));
  at(BEAT.plugins + 9600, () => {
    sound("complete");
    scene.set({ pr: "merged" });
  });
  at(BEAT.plugins + 10800, () => {
    hideCaption();
    scene.set({ pr: "hidden", focus: null, settings: "open" });
  });
  at(BEAT.plugins + 11400, () => caption(copy.captions.market));
  at(BEAT.plugins + 11600, () => settingsClick("[data-category='market']", 0, 700));
  at(BEAT.plugins + 13000, () => {
    caption(copy.captions.install);
    scene.set({ zoom: { ...settingsPoint(".plugin-market__action .plugin-card__button", 0), scale: 1.9 } });
  });
  at(BEAT.plugins + 13600, () => settingsClick(".plugin-market__action .plugin-card__button", 0, 700));
  at(BEAT.plugins + 15000, () => scene.set((current) => ({ zoom: { ...current.zoom, scale: 1 } })));
  at(BEAT.plugins + 15600, () => scene.set((current) => ({ settings: "closed", cursor: { ...current.cursor, visible: false } })));
  at(BEAT.plugins + 15800, () => {
    caption(copy.captions.mine);
    void pluginsShown(copy, true);
    moveCamera(ZOOM.bar, 900);
  });
  at(BEAT.plugins + 17400, () => caption(copy.captions.detail));
  at(BEAT.plugins + 17600, () => island.pointAt(".plugin-status-chip--batteries", 0, 600));
  at(BEAT.plugins + 18400, () => nativeTip(".plugin-status-chip--batteries", copy.plugin.tooltip));

  at(BEAT.end - 400, () => {
    hideCaption();
    hideStageCursor();
    nativeTip(".plugin-status-chip--batteries", null);
  });
  at(BEAT.end, () => {
    moveCamera(1, 900);
    stage.set({ dim: 0.86, endCard: true });
  });
}
