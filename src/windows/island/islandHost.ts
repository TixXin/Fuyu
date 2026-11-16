import type { IslandHost } from "../../features/plugin-kernel/islandHost";
import { listenIslandHover, listenIslandOutsideClick, setIslandOutsideClickWatch } from "./api";

export const islandHost: IslandHost = {
  listenHover: listenIslandHover,
  listenOutsideClick: listenIslandOutsideClick,
  setOutsideClickWatch: setIslandOutsideClickWatch,
};
