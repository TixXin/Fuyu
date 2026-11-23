import { useCallback, type KeyboardEvent } from "react";

const CELL = "[data-icon-cell]";

function nearestVertical(cells: HTMLElement[], from: HTMLElement, direction: 1 | -1): HTMLElement | undefined {
  const origin = from.getBoundingClientRect();
  let best: HTMLElement | undefined;
  let bestScore = Infinity;
  for (const cell of cells) {
    const box = cell.getBoundingClientRect();
    const dy = (box.top - origin.top) * direction;
    if (dy <= 4) continue;
    const score = dy * 4 + Math.abs(box.left - origin.left);
    if (score < bestScore) {
      bestScore = score;
      best = cell;
    }
  }
  return best;
}

export function useGridKeys() {
  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    const from = (event.target as HTMLElement).closest<HTMLElement>(CELL);
    if (!from) return;
    const cells = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(CELL));
    const index = cells.indexOf(from);
    const target =
      event.key === "ArrowRight" ? cells[index + 1]
      : event.key === "ArrowLeft" ? cells[index - 1]
      : event.key === "ArrowDown" ? nearestVertical(cells, from, 1)
      : event.key === "ArrowUp" ? nearestVertical(cells, from, -1)
      : event.key === "Home" ? cells[0]
      : event.key === "End" ? cells[cells.length - 1]
      : undefined;
    if (!target) return;
    event.preventDefault();
    from.tabIndex = -1;
    target.tabIndex = 0;
    target.focus();
    target.scrollIntoView({ block: "nearest" });
  }, []);
}
