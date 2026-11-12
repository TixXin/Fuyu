import { CenterPattern } from "./CenterPattern";
import type { CenterPatternChoice } from "./centerSettings";
import type { PetMood } from "./patterns";
import { PetSprite } from "./PetSprite";

export const AGENT_ICON_PET_HEIGHT = 18;

const markHeight = (pill: number) => (pill * 17) / 16;
const markWidth = (pill: number) => Math.ceil((pill * 36) / 16);
export const MARK_HEIGHT = markHeight(24);
export const MARK_WIDTH = markWidth(24);

export function centerHeight(pattern: CenterPatternChoice["pattern"], size: number) {
  return pattern === "pet" ? size + 4 : pattern === "mark" ? markHeight(size) : size;
}

export function centerWidth(pattern: CenterPatternChoice["pattern"], size: number) {
  if (pattern === "pet") return Math.ceil(((size + 4) * 192) / 208) + 4;
  return pattern === "mark" ? markWidth(size) + 2 : size * 2;
}

export const agentIconMarkExtraWidth = (size: number) => markWidth(size) - 16;

export function CollapsedCenter({
  choice,
  sheet,
  mood,
  paused,
  size,
}: {
  choice: CenterPatternChoice;
  sheet: string | null | undefined;
  mood: PetMood;
  paused: boolean;
  size: number;
}) {
  if (choice.pattern !== "pet") {
    return <CenterPattern pattern={choice.pattern} paused={paused} height={centerHeight(choice.pattern, size)} mood={mood} />;
  }
  if (sheet === undefined) return null;
  if (sheet === null) return <CenterPattern pattern="eyes" paused={paused} height={size} />;
  return <PetSprite src={sheet} mood={mood} paused={paused} height={centerHeight("pet", size)} />;
}
