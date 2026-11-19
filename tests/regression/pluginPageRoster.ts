import { act } from "react";
import { marketV1, pluginConfigV1 } from "@fuyu/plugin-services";
import type { TRANSLATIONS } from "../../src/i18n";
import { ROSTER_KEY, ROSTER_LOCAL_KEY, type RosterItem } from "../../src/lib/plugin-roster/roster";
import { loadRoster, loadRosterLocal, saveRoster, saveRosterLocal } from "../../src/lib/plugin-roster/storage";
import { configCalls, market, windowServices } from "./pluginPageMocks";

interface RosterCheckTools {
  check: (condition: unknown, message: string) => void;
  click: (element: Element | null | undefined) => Promise<void>;
  settle: (ms?: number) => Promise<void>;
  within: (key: string, selector: string) => HTMLElement | null;
  text: (typeof TRANSLATIONS)["en"]["settings"]["pluginsV3"]["page"]["banners"]["roster"];
}

const SYNCED: RosterItem[] = [
  { id: "@fuyu/countdown", source: "market", enabled: false, config: { city: "Hangzhou" } },
  { id: "@someone/stocks", source: "market", enabled: true, configOmitted: "tooLarge" },
  { id: "@someone/old", source: "market", enabled: true },
  { id: "@me/handmade", source: "manual", enabled: true },
];
const WEATHER: RosterItem = { id: "@fuyu/weather", source: "market", enabled: true, config: { unit: "fahrenheit" } };

export async function checkRoster({ check, click, settle, within, text }: RosterCheckTools) {
  const put = (items: RosterItem[]) => act(async () => saveRoster(items));
  const refresh = () => act(async () => { await windowServices.get(marketV1).setManualAllowed({ allowed: market.manualAllowed }); });
  const missing = (key = "normal") => within(key, "[data-banner='roster-missing']");
  const settings = () => within("normal", "[data-banner='roster-settings']");
  check(!missing() && !settings(), "Roster: with nothing synced or restored, no banner is shown");

  await put(SYNCED);
  await settle();
  check(missing()?.querySelector(".plugin-banner__title")?.textContent === text.missing(4), "Roster: plugins another device has and this one lacks raise one banner, counted in its title");
  check(missing()?.querySelector("[data-action='roster-install']")?.textContent === text.installAll(2), "Only the ones the market can install directly are behind the install button");
  check(missing()?.querySelector("[data-roster='manual']")?.textContent!.includes("@me/handmade") && missing()?.querySelector("[data-roster='unavailable']") && missing()?.querySelector("[data-roster='too-large']"), "A file-installed plugin is only named, one this device cannot install is called out, and settings left behind for size are mentioned");
  const narrow = missing("narrow-error");
  check(narrow && narrow.scrollWidth <= narrow.clientWidth + 1, "The banner does not spill out sideways at 340 px");

  await click(missing()?.querySelector("[data-action='roster-install']"));
  await settle(200);
  const seeded = configCalls.indexOf("set:@fuyu/countdown:{\"city\":\"Hangzhou\"}");
  const installedAt = market.calls.findIndex((call) => call.startsWith("install:@fuyu/countdown@"));
  check(seeded >= 0 && installedAt >= 0 && market.calls.indexOf("enabled:@fuyu/countdown=false") > installedAt, "Installing writes the plugin's settings, installs it from the market, then switches it off as on the other device");
  check(market.calls.some((call) => call.startsWith("install:@someone/stocks@")) && !market.calls.includes("enabled:@someone/stocks=false") && !market.calls.some((call) => call.startsWith("install:@someone/old@") || call.startsWith("install:@me/handmade@")), "The rest of the batch is installed too; nothing else is");
  check(missing()?.querySelector(".plugin-banner__title")?.textContent === text.missing(2) && !missing()?.querySelector("[data-action='roster-install']"), "What could not be installed stays listed, without an install button");

  await click(missing()?.querySelector("[data-action='roster-dismiss']"));
  await settle();
  check(!missing() && loadRosterLocal().dismissed.join() === "@me/handmade,@someone/old" && loadRoster().length === SYNCED.length, "Dismissing hides them on this device only; the roster itself is untouched");

  await put([WEATHER]);
  await settle();
  check(settings()?.querySelector(".plugin-banner__title")?.textContent === text.settings(1), "Roster: an installed plugin whose settings differ on the other device gets its own banner");
  await click(settings()?.querySelector("[data-action='roster-keep-mine']"));
  await settle();
  check(!settings() && loadRoster().find((item) => item.id === "@fuyu/weather")?.config?.unit === "celsius", "Keep mine puts this device's settings into the roster");

  await put([WEATHER]);
  await settle();
  const before = configCalls.length;
  await click(settings()?.querySelector("[data-action='roster-use-theirs']"));
  await settle(200);
  check(configCalls.slice(before).join() === "set:@fuyu/weather:{\"unit\":\"fahrenheit\"}" && !market.calls.some((call) => call.startsWith("enabled:@fuyu/weather=")), "Use those settings changes just the differing field through the plugin's form, with no restart");
  check(!settings(), "and the banner goes away");

  await act(async () => { await windowServices.get(pluginConfigV1).set({ id: "@fuyu/weather", values: { unit: "celsius" } }); });
  configCalls.pop();
  delete market.installed["@fuyu/countdown"];
  delete market.installed["@someone/stocks"];
  await act(async () => {
    saveRoster([]);
    saveRosterLocal({ seen: {}, dismissed: [] });
    localStorage.removeItem(ROSTER_KEY);
    localStorage.removeItem(ROSTER_LOCAL_KEY);
  });
  await refresh();
  await settle();
}
