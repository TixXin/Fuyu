import { createContext, useContext } from "react";
import type { JellyfishStyle } from "../../lib/settings/types";

export const JellyfishStyleContext = createContext<JellyfishStyle>("vector");

export function useJellyfishStyle(): JellyfishStyle {
  return useContext(JellyfishStyleContext);
}
