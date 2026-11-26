import { act } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, TRANSLATIONS } from "../../src/i18n";
import type { SyncStatus } from "../../src/features/sync/api";

type Tools = {
  check: (condition: unknown, message: string) => void;
  settle: () => Promise<void>;
  setInputValue: (input: HTMLInputElement, value: string) => void;
  overflowing: (root: HTMLElement) => HTMLElement[];
  calls: { command: string }[];
};

export async function checkLanSection(parent: HTMLElement, status: SyncStatus, { check, settle, setInputValue, overflowing, calls }: Tools) {
  const { SyncLanSection } = await import("../../src/features/sync/SyncLanSection");
  const lanBox = document.createElement("div");
  lanBox.style.cssText = "width: 340px; display: grid; gap: 8px;";
  parent.append(lanBox);
  const lanStatus = { ...status, backend: "lan" as const, phase: "idle" as const };
  await act(async () => {
    createRoot(lanBox).render(<I18nProvider><SyncLanSection status={lanStatus} busy={false} /></I18nProvider>);
  });
  await settle();
  const lanText = TRANSLATIONS["zh-CN"].sync.backend.lan;
  const lanButton = (label: string) => [...lanBox.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes(label));
  await act(async () => { lanButton(lanText.enable)!.click(); });
  await settle();
  check(
    calls.some((call) => call.command === "set_sync_lan")
      && lanBox.textContent?.includes(lanText.thisDeviceHint("ABCD-1234", 47321))
      && lanBox.textContent?.includes("Windows PC"),
    "Turning on the local network link shows this computer's ID and port and a Fuyu found nearby",
  );
  await act(async () => { lanButton(lanText.showCode)!.click(); });
  await settle();
  check(lanBox.querySelector(".sync-lan__code")?.textContent === "482913", "Show pairing code puts the 6 digits on screen");
  await act(async () => { lanButton(lanText.nearbyUse)!.click(); });
  await settle();
  const [addressInput, codeInput] = [...lanBox.querySelectorAll<HTMLInputElement>(".sync-lan__join input")];
  check(addressInput.value === "192.168.1.20:47321", "Use address fills in the nearby computer's address");
  await act(async () => { setInputValue(codeInput, "000000"); });
  await settle();
  await act(async () => { lanButton(lanText.join)!.click(); });
  await settle();
  check(lanBox.textContent?.includes("配对码不对"), "A wrong pairing code shows the localized sync.lanWrongCode error");
  await act(async () => { setInputValue(codeInput, "482913"); });
  await settle();
  await act(async () => { lanButton(lanText.join)!.click(); });
  await settle();
  check(
    lanBox.textContent?.includes(lanText.peerHint("FFFF-FFFF", "192.168.1.20:47321")) && !lanBox.textContent?.includes(lanText.peersEmpty),
    "Pairing lists the other computer with its ID and address",
  );
  check(overflowing(lanBox).length === 0 && lanBox.scrollWidth <= 340, "The local network section fits a 340px narrow container");
}
