import { act } from "react";

type Helpers = {
  root: HTMLElement;
  header: HTMLElement;
  check: (condition: unknown, label: string) => void;
  settle: (condition: () => unknown) => Promise<unknown>;
  frame: () => Promise<void>;
  textTab: (on: boolean) => Promise<void>;
};

const finders = (root: HTMLElement) => ({
  moreTrigger: () => root.querySelector<HTMLButtonElement>(".editor-dots .island__header-more"),
  moreMenu: () => root.querySelector<HTMLElement>(".island-header-more-menu"),
  textTab: () => root.querySelector(".island__header .panel-text-icon"),
});

export async function checkHeaderMoreMenu({ root, header, check, settle }: Helpers) {
  const { moreTrigger, moreMenu, textTab } = finders(root);
  const tabs = () => [...root.querySelectorAll<HTMLButtonElement>(".island__title button, .editor-dots .dot-button")];
  const hiddenCount = () => Number(/\d+/.exec(moreTrigger()?.textContent ?? "")?.[0] ?? 0);
  const actionsBox = root.querySelector<HTMLElement>(".island__header > .window-actions")!.getBoundingClientRect();
  check(await settle(() => moreTrigger()), "页签纯图标也放不下时，末尾出现「更多」按钮");
  check(tabs().length + hiddenCount() >= 15 && tabs().every((tab) => tab.getBoundingClientRect().right <= actionsBox.left + 0.5) && header.scrollWidth <= header.clientWidth + 0.5,
    `装了很多插件（${tabs().length} 个露在页头，${hiddenCount()} 个收进「更多」）时页头不溢出，不压住右边的操作按钮`);
  check(!textTab() && /^更多页面/.test(moreTrigger()!.getAttribute("aria-label") ?? ""), `放不下时页签都是纯图标，「更多」按钮有名字（${moreTrigger()!.getAttribute("aria-label")}）`);
  const pill = root.querySelector<HTMLElement>(".island__page-pill")!;
  const near = (value: string, expected: number) => Math.abs(parseFloat(value) - expected) < 0.5;
  const headerBox = header.getBoundingClientRect();
  check(await settle(() => near(pill.style.left, moreTrigger()!.getBoundingClientRect().left - headerBox.left)) && !root.querySelector('.dot-button[data-page="more-9"]')
    && moreTrigger()!.classList.contains("island__header-more--active"), "打开的那页收在「更多」里时，「更多」按钮显示成当前页，胶囊盖在它上面");
  await act(async () => moreTrigger()!.click());
  const items = () => [...(moreMenu()?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [])];
  check(items().length === hiddenCount() && items().find((item) => item.dataset.page === "more-9")?.getAttribute("aria-current") === "page"
    && items().every((item) => item.querySelector(".island-header-more-menu__icon") && item.textContent?.trim()), "点「更多」列出放不下的页面（图标加名字），当前页标成选中");
  const target = items().find((item) => item.dataset.page === "more-5")!;
  await act(async () => target.click());
  check(!moreMenu() && moreTrigger()!.classList.contains("island__header-more--active"), "在下拉里点一页就切过去，下拉收起");
  await act(async () => moreTrigger()!.click());
  check(items().find((item) => item.dataset.page === "more-5")?.getAttribute("aria-current") === "page", "再打开下拉，刚选的那页是当前页");
  await act(async () => { document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  check(!moreMenu(), "点下拉外面收起");
  await act(async () => {
    moreTrigger()!.focus();
    moreTrigger()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  });
  check(await settle(() => document.activeElement?.getAttribute("data-page") === "more-5"), "焦点在「更多」上按下方向键打开下拉，焦点落到当前页");
  await act(async () => { document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); });
  const next = document.activeElement as HTMLButtonElement;
  check(next.getAttribute("data-page") === "more-6", `方向键在下拉里移动焦点（${next.getAttribute("data-page")}）`);
  await act(async () => next.click());
  check(!moreMenu() && items().length === 0, "用键盘移到的那页选中后切过去，下拉收起");
  await act(async () => moreTrigger()!.click());
  await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
  check(!moreMenu() && document.activeElement === moreTrigger(), "按 Esc 收起下拉，焦点回到「更多」");
}

export async function checkHeaderTabFit({ root, header, check, settle, frame, textTab: showTextTab }: Helpers) {
  const { moreTrigger, textTab } = finders(root);
  const stage = root.querySelector<HTMLElement>(".stage")!;
  const state = () => (moreTrigger() ? "more" : textTab() ? "full" : "icons");
  const tidy = () => {
    const edge = header.querySelector<HTMLElement>(":scope > .window-actions")!.getBoundingClientRect().left;
    const lead = header.querySelector<HTMLElement>(".window-actions--lead")!.getBoundingClientRect();
    const limit = lead.width > 0 ? lead.left : edge;
    return header.scrollWidth <= header.clientWidth + 0.5
      && [...header.querySelectorAll<HTMLElement>(".island__title button, .editor-dots button")].every((button) => button.getBoundingClientRect().right <= limit + 0.5);
  };
  const resize = async (width: number, scale = 1) => {
    stage.style.setProperty("--expanded-island-width", `${width}px`);
    stage.style.setProperty("--island-expanded-scale", String(scale));
    await frame();
    await frame();
  };
  await showTextTab(true);
  check(await settle(() => state() === "full"), "首页页签选成文字时，放得下就显示文字");
  const seen: string[] = [];
  const messy: number[] = [];
  let iconsAt = 0;
  for (let width = 560; width >= 220; width -= 4) {
    await resize(width);
    if (seen[seen.length - 1] !== state()) seen.push(state());
    if (state() === "icons" && !iconsAt) iconsAt = width;
    if (!tidy()) messy.push(width);
  }
  check(seen.join(" > ") === "full > icons > more", `页头变窄时先收成纯图标，再出现「更多」（${seen.join(" > ")}）`);
  check(messy.length === 0, `每个宽度下页签都不溢出、不压住操作按钮（${messy.join(", ")}）`);
  const iconTab = root.querySelector<HTMLButtonElement>('.dot-button[data-page="panel:fuyu"]');
  await resize(iconsAt);
  check(state() === "icons" && iconTab?.querySelector(".center-jelly") && /^\S/.test(iconTab.getAttribute("aria-label") ?? ""), "收成纯图标时文字页签换成图标，aria-label 仍是页面名");
  await resize(iconsAt, 1.4);
  check(state() === "icons" && tidy(), "展开缩放改成 1.4 时，同样宽度下判断不变，页签也不溢出");
  await resize(560);
  check(await settle(() => state() === "full"), "放宽后恢复带文字的页签");
  stage.style.removeProperty("--expanded-island-width");
  stage.style.removeProperty("--island-expanded-scale");
  await showTextTab(false);
}
