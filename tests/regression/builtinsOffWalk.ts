import { act } from "react";
import { emit } from "@tauri-apps/api/event";
import { DEV_ISLAND_ACTION_EVENT } from "../../src/features/island-bridge/api";
import { windowSlots } from "../../src/features/plugin-kernel/slots";
import type { IpcLedger } from "../../src/features/plugin-kernel/ipcLedger";

export type Places = Map<string, Set<string>>;

export interface Domains {
  classes: ReadonlyMap<string, string>;
  commands: ReadonlyMap<string, string>;
  events: ReadonlyMap<string, string>;
}

const settle = (ms = 30) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

async function press(element: HTMLElement | null) {
  if (!element) return false;
  await act(async () => { element.click(); });
  await settle();
  return true;
}

function classesNow(): Set<string> {
  const found = new Set<string>();
  for (const element of document.querySelectorAll("#root [class]")) {
    for (const name of element.classList) found.add(name);
  }
  return found;
}

export async function walk(): Promise<Places> {
  const places: Places = new Map();
  const record = (label: string) => places.set(label, classesNow());
  await settle(60);
  record("island collapsed");
  if (await press(document.querySelector<HTMLElement>(".island__open-button"))) {
    record("island expanded");
    for (const page of windowSlots("island").items("island.page/v1").map((item) => item.id)) {
      await act(async () => { await emit(DEV_ISLAND_ACTION_EVENT, { action: "open", page }); });
      await settle();
      record(`island page ${page}`);
    }
    if (await press(document.querySelector<HTMLElement>(".island__header button.island-message-button, button.island-message-button"))) record("island messages");
  }
  const categories = [...document.querySelectorAll<HTMLElement>(".settings-sidebar__item[data-category]")].map((item) => item.dataset.category!);
  for (const category of categories) {
    if (!(await press(document.querySelector<HTMLElement>(`.settings-sidebar__item[data-category='${category}']`)))) continue;
    const tabs = [...document.querySelectorAll<HTMLElement>(".settings-tabs__tab[data-tab]")].map((tab) => tab.dataset.tab!);
    if (!tabs.length) record(`settings ${category}`);
    for (const tab of tabs) {
      if (await press(document.querySelector<HTMLElement>(`.settings-tabs__tab[data-tab='${tab}']`))) record(`settings ${category}/${tab}`);
    }
  }
  return places;
}

export function ownersOfItems(): Set<string> {
  const owners = new Set<string>();
  for (const window of ["island", "settings"] as const) {
    const registry = windowSlots(window);
    for (const name of registry.names()) for (const item of registry.items(name)) owners.add(item.owner);
  }
  return owners;
}

export function seenIn(places: Places, classes: ReadonlyMap<string, string>, id: string): string[] {
  const mine = [...classes].filter(([, owner]) => owner === id).map(([name]) => name);
  return [...places].filter(([, seen]) => mine.some((name) => seen.has(name))).map(([label]) => label);
}

export function residue(id: string, places: Places, domains: Domains, ledger: IpcLedger, callsBefore: Record<string, number>): string[] {
  const found: string[] = [];
  const mine = (table: ReadonlyMap<string, string>) => [...table].filter(([, owner]) => owner === id).map(([name]) => name);
  for (const window of ["island", "settings"] as const) {
    const registry = windowSlots(window);
    for (const name of registry.names()) {
      const items = registry.items(name).filter((item) => item.owner === id);
      if (items.length) found.push(`${id}: ${window} still shows ${items.map((item) => item.id).join(", ")} in ${name}`);
    }
  }
  const classes = mine(domains.classes);
  for (const [label, seen] of places) {
    const left = classes.filter((name) => seen.has(name));
    if (left.length) found.push(`${id}: ${label} still renders .${left.slice(0, 3).join(", .")}${left.length > 3 ? ` (+${left.length - 3})` : ""}`);
  }
  const { calls } = ledger.snapshot();
  for (const command of mine(domains.commands)) {
    const more = (calls[command] ?? 0) - (callsBefore[command] ?? 0);
    if (more > 0) found.push(`${id}: called ${command} ${more} times while off`);
  }
  for (const event of mine(domains.events)) {
    const count = ledger.listening(event);
    if (count > 0) found.push(`${id}: still listens to ${event} (${count})`);
  }
  return found;
}
