import { installBackend } from "./backend";
import { createWorld, type World } from "./world";

export type IslandFrame = Window & {
  __world: World;
  __emit: (event: string, payload: unknown) => Promise<void>;
  __seed?: (world: World) => void;
};

const params = new URLSearchParams(location.search);
localStorage.clear();
localStorage.setItem("fuyu-locale", params.get("lang") === "en" ? "en" : "zh-CN");
localStorage.setItem("fuyu-onboarding-done", "1");

const world = createWorld();
const host = window as unknown as IslandFrame;
(window.parent as unknown as IslandFrame).__seed?.(world);
const backend = installBackend(world);
host.__world = world;
host.__emit = backend.emit;

await import("../../../src/main.tsx");
