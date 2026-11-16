import { coverAccentVariables } from "../../features/media/useCoverColor";
import type { IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";

type LegacyStyleInput = {
  cover: boolean;
  coverColor: string | null;
  glassTint: string | null;
  background: string;
  accent: string | null;
};

export function useLegacyStyle({ cover, coverColor, glassTint, background, accent }: LegacyStyleInput) {
  const list: IslandContribution[] = [];
  if (cover) list.push({ kind: "style", vars: coverAccentVariables(coverColor, background, accent), className: "cover-color" });
  if (glassTint) list.push({ kind: "style", tint: glassTint });
  useIslandContributions("builtin", "legacy.style", list);
}
