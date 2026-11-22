type Helpers = {
  check: (condition: unknown, label: string) => void;
  set: (next: { more?: boolean; expanded?: boolean }) => Promise<void>;
  widen: (px: number) => Promise<void>;
  settle: () => Promise<void>;
  island: () => HTMLElement;
  bar: () => HTMLElement;
  clocks: () => HTMLElement[];
  openPanelNames: () => Promise<(string | null)[]>;
};

export async function checkPillOverflow({ check, set, widen, settle, island, bar, clocks, openPanelNames }: Helpers) {
  const chip = () => bar().querySelector<HTMLButtonElement>(".island__more-chip");
  const inside = (element: Element) => element.getBoundingClientRect().right <= island().getBoundingClientRect().right + 0.5;
  check(!chip() && clocks().length === 5, "没有刘海、放得下时不出「+N」，收起条照旧");
  await widen(110);
  await settle();
  const shown = clocks().map((clock) => clock.textContent);
  const away = 5 - shown.length;
  const task = bar().querySelector<HTMLElement>(".island__active-task");
  check(away > 0 && chip()?.textContent === `+${away}` && shown.join() === ["TYO", "LON", "NYC", "SYD", "PAR"].slice(0, shown.length).join(),
    `没有刘海时超过最宽 520 放不下的项目整项收进「+N」，按清单顺序先放（岛上：${shown.join()}）`);
  check(Math.abs(island().getBoundingClientRect().width - 520) < 1, `放不下时岛撑到最宽 520（${island().getBoundingClientRect().width}px）`);
  check(clocks().every(inside) && inside(chip()!) && bar().scrollWidth <= bar().clientWidth + 1, "收起来以后收起条里的东西都在岛内，不再从右边缘裁掉");
  check(task && task.getBoundingClientRect().width >= 60, "中间的文字留着位置，不被项目挤没");
  const names = await openPanelNames();
  check(names.join() === ["时钟 TYO", "时钟 LON", "时钟 NYC", "时钟 SYD", "时钟 PAR"].slice(shown.length).join(), `小面板里是收起来的那几项（${names.join()}）`);
  await widen(44);
  await set({ expanded: true });
  await settle();
  await set({ expanded: false });
  await settle();
  check(!chip() && clocks().length === 5, "收进「+N」的项目变窄后，岛展开再收起时重新量，放得下就回到收起条上");
  await widen(110);
  await settle();
  await set({ more: false });
  await settle();
  check(!chip() && clocks().length === 5, "关掉「放不下的项目收进「+N」」，没有刘海时也回到以前的排法");
  await widen(44);
  await set({ more: true });
  await settle();
  check(!chip() && clocks().length === 5 && !bar().querySelector(".island__bar-unit"), "岛宽回来、放得下以后「+N」消失，收起条回到原来的结构");
}
