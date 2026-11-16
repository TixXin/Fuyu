import type { IslandHost } from "../../features/plugin-kernel/islandHost";
import { listenIslandBannerHover, listenIslandHover, listenIslandOutsideClick, setIslandBannerRect, setIslandOutsideClickWatch } from "./api";

export const islandHost: IslandHost = {
  listenHover: listenIslandHover,
  listenOutsideClick: listenIslandOutsideClick,
  setOutsideClickWatch: setIslandOutsideClickWatch,
  listenBannerHover: listenIslandBannerHover,
  setBannerRect: setIslandBannerRect,
};
