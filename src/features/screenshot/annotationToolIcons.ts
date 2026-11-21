import { Circle, Droplets, Focus, Grid3x3, Hash, Highlighter, Minus, MoveUpRight, Pencil, Square, Type, type LucideIcon } from "lucide-react";
import type { AnnotationTool } from "./annotations";

export const TOOL_ICONS: Record<AnnotationTool, LucideIcon> = {
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: MoveUpRight,
  pen: Pencil,
  highlighter: Highlighter,
  text: Type,
  mosaic: Grid3x3,
  blur: Droplets,
  spotlight: Focus,
  number: Hash,
};
