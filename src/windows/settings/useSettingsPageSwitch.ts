import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { PageSwitchEffect, PageSwitchIndicator, PageSwitchSpeed } from "../../lib/settings/types";
import { nextCarouselTurn, pageSwitchSpeed, resolveIndicator, resolvePageSwitch, type SwitchAxis } from "../../lib/theme/pageSwitch";
import { playPageSwitch, type PageSwitchHandle } from "../../lib/theme/playPageSwitch";
import { glideIndicator } from "./glideIndicator";
import type { SettingsCategory } from "./categories";

export type SettingsSwitchMotion = { effect: PageSwitchEffect; indicator: PageSwitchIndicator; speed: PageSwitchSpeed; directional: boolean };

type Marks = { category: SettingsCategory; item: HTMLElement | null; tab: HTMLElement | null };
type Anchor = { from: HTMLElement; to: HTMLElement; axis: SwitchAxis };

const ACTIVE_ITEM = ".settings-sidebar__item--active";
const ACTIVE_TAB = ".settings-tabs__tab--active";

function moved(before: HTMLElement | null, after: HTMLElement | null): before is HTMLElement {
  return Boolean(before?.isConnected && after && before !== after);
}

function centerIn(stage: HTMLElement, element: HTMLElement) {
  const box = stage.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top };
}

export function useSettingsPageSwitch(
  category: SettingsCategory,
  layoutRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  motion: SettingsSwitchMotion,
) {
  const marks = useRef<Marks | null>(null);
  const instant = useRef(false);
  const running = useRef<{ page: PageSwitchHandle | null; glides: (() => void)[] }>({ page: null, glides: [] });
  const motionRef = useRef(motion);
  useLayoutEffect(() => {
    motionRef.current = motion;
  });

  const finish = useCallback(() => {
    running.current.page?.finish();
    for (const stop of running.current.glides) stop();
    running.current = { page: null, glides: [] };
  }, []);

  useEffect(() => finish, [finish]);

  useLayoutEffect(() => {
    const root = layoutRef.current;
    if (!root) return;
    const item = root.querySelector<HTMLElement>(ACTIVE_ITEM);
    const tab = root.querySelector<HTMLElement>(ACTIVE_TAB);
    const before = marks.current;
    marks.current = { category, item, tab };
    if (!before || before.category === category) return;
    finish();
    if (instant.current) {
      instant.current = false;
      return;
    }
    const current = motionRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = pageSwitchSpeed(current.speed);
    const indicator = resolveIndicator(current.indicator, reduced);
    const list = root.querySelector<HTMLElement>(".settings-sidebar__list");
    const bar = root.querySelector<HTMLElement>(".settings-tabs");
    const tabMoved = moved(before.tab, tab) && tab !== null;
    const itemMoved = moved(before.item, item) && item !== null;
    if (itemMoved && list && before.item) {
      running.current.glides.push(glideIndicator({ container: list, from: before.item, to: item, axis: "y", mode: indicator, speed, ghostClass: "settings-sidebar__ghost" }));
    }
    if (tabMoved && bar && before.tab) {
      running.current.glides.push(glideIndicator({ container: bar, from: before.tab, to: tab, axis: "x", mode: indicator, speed, ghostClass: "settings-tabs__ghost", inset: 10 }));
    }
    const panel = panelRef.current;
    if (!panel) return;
    const effect = resolvePageSwitch(current.effect, current.effect === "carousel" ? nextCarouselTurn() : 0, reduced);
    if (effect === "none") return;
    const anchor: Anchor | null = tabMoved && before.tab ? { from: before.tab, to: tab, axis: "x" } : itemMoved && before.item ? { from: before.item, to: item, axis: "y" } : null;
    const axis: SwitchAxis = anchor?.axis ?? "y";
    let direction: -1 | 0 | 1 = 0;
    if (anchor && current.directional) {
      const a = anchor.from.getBoundingClientRect();
      const b = anchor.to.getBoundingClientRect();
      const delta = axis === "x" ? b.left - a.left : b.top - a.top;
      direction = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    }
    const origin = anchor && current.directional ? centerIn(panel, anchor.to) : null;
    running.current.page = playPageSwitch({ stage: panel, targets: [panel], effect, direction, axis, origin, speed });
  }, [category, finish, layoutRef, panelRef]);

  return useCallback(() => {
    instant.current = true;
  }, []);
}
