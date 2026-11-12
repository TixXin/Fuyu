import { readJson, writeJson } from "../../lib/storage.ts";
import { ANNOTATION_COLORS, STROKE_LEVELS, type AnnotationStyle, type StrokeLevel } from "./annotations.ts";

export const ANNOTATION_STYLE_KEY = "fuyu-screenshot-annotation";

export const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = { color: ANNOTATION_COLORS[0], level: 1 };

export function normalizeAnnotationStyle(value: unknown): AnnotationStyle {
  const saved = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const color = (ANNOTATION_COLORS as readonly unknown[]).includes(saved.color) ? (saved.color as string) : DEFAULT_ANNOTATION_STYLE.color;
  const level = (STROKE_LEVELS as readonly unknown[]).includes(saved.level) ? (saved.level as StrokeLevel) : DEFAULT_ANNOTATION_STYLE.level;
  return { color, level };
}

export function loadAnnotationStyle(): AnnotationStyle {
  return normalizeAnnotationStyle(readJson(ANNOTATION_STYLE_KEY));
}

export function saveAnnotationStyle(style: AnnotationStyle) {
  writeJson(ANNOTATION_STYLE_KEY, style);
}
