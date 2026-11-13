import { DayScenery, type DayScene } from "../../stage/day/DayScenery";
import type { Lang } from "../types";
import { copyFor } from "./copy";

export type SceneId = "dawn" | "morning" | "meeting" | "noon" | "afternoon" | "copy" | "translate" | "night";

export function scenes(lang: Lang): (DayScene & { id: SceneId })[] {
  const { labels } = copyFor(lang);
  return [
    { id: "dawn", time: "07:00", label: "", hour: 7, sky: ["#5b6fb0", "#f3a683"], ink: "light", sun: { x: 16, y: 96, color: "#ffd9a8" } },
    { id: "morning", time: "08:30", label: labels.morning, hour: 8.5, sky: ["#8fc1f0", "#ffe6cf"], ink: "dark", sun: { x: 26, y: 76, color: "#fff1cc" } },
    { id: "meeting", time: "10:00", label: labels.meeting, hour: 10, sky: ["#6fb2f2", "#e2f1ff"], ink: "dark", sun: { x: 38, y: 60, color: "#fff8e0" } },
    { id: "noon", time: "11:20", label: labels.noon, hour: 11.33, sky: ["#4f9ff0", "#cfe8ff"], ink: "dark", sun: { x: 50, y: 52, color: "#ffffff" } },
    { id: "afternoon", time: "14:00", label: labels.afternoon, hour: 14, sky: ["#5b9be6", "#ffe7b5"], ink: "dark", sun: { x: 64, y: 60, color: "#fff0c2" } },
    { id: "copy", time: "16:30", label: labels.copy, hour: 16.5, sky: ["#7d8fd6", "#ffc890"], ink: "dark", sun: { x: 76, y: 74, color: "#ffd79a" } },
    { id: "translate", time: "17:10", label: labels.translate, hour: 17.17, sky: ["#8a7fcf", "#ffb37f"], ink: "dark", sun: { x: 82, y: 84, color: "#ffc078" } },
    { id: "night", time: "21:00", label: labels.night, hour: 21, sky: ["#3b4391", "#7b5a9e"], ink: "light", sun: { x: 74, y: 58, color: "#f4f1ff", size: 110 } },
  ];
}

export function scenery(lang: Lang) {
  const copy = copyFor(lang);
  return <DayScenery title={copy.title} subtitle={copy.subtitle} scenes={scenes(lang)} />;
}
