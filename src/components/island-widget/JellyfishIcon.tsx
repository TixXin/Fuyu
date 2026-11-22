import { JellyfishMark } from "../jellyfish/JellyfishMark";

type JellyfishIconProps = { size?: number | string; strokeWidth?: number | string; absoluteStrokeWidth?: boolean; className?: string };

export function JellyfishIcon({ size = 16 }: JellyfishIconProps) {
  const px = typeof size === "number" ? size : Number.parseFloat(size) || 16;
  return <JellyfishMark mood="idle" paused height={px} />;
}
