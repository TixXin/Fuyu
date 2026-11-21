import { useSyncExternalStore } from "react";
import type { DetentId, PresetId } from "./detents.ts";

export type HandleKind = "grab" | "cap" | "edge" | "knob" | "bead";
export type ResizeSpec = { kind: HandleKind; widthSign: -1 | 0 | 1; height: boolean; preset: boolean };
export type ResizeLabel = { width?: DetentId; height?: DetentId; preset?: PresetId };
export type ResizeState = {
  drag: ResizeSpec | null;
  label: ResizeLabel;
  editing: boolean;
  flash: number;
};

let state: ResizeState = { drag: null, label: {}, editing: false, flash: 0 };
const listeners = new Set<() => void>();

function set(next: Partial<ResizeState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getResizeState() {
  return state;
}

export function useResizeState() {
  return useSyncExternalStore(subscribe, getResizeState, getResizeState);
}

function sameLabel(a: ResizeLabel, b: ResizeLabel) {
  return a.width === b.width && a.height === b.height && a.preset === b.preset;
}

export function beginResizeDrag(spec: ResizeSpec) {
  set({ drag: spec, label: {} });
}

export function setResizeLabel(label: ResizeLabel) {
  if (sameLabel(label, state.label)) return;
  const landed = Boolean(label.width || label.height || label.preset);
  set({ label, flash: landed ? state.flash + 1 : state.flash });
}

export function endResizeDrag() {
  set({ drag: null });
}

export function setResizeEditing(editing: boolean) {
  if (editing !== state.editing) set({ editing, label: {} });
}

export function isResizeEditing() {
  return state.editing;
}
