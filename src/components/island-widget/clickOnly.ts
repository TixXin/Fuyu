import type { MouseEvent } from "react";

export const clickOnly = (action: () => void) => (event: MouseEvent) => {
  event.stopPropagation();
  action();
};
