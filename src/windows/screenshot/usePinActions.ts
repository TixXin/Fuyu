import { useCallback, useState } from "react";
import { Menu } from "@tauri-apps/api/menu";
import {
  closeAllPins,
  collapsePin,
  copyPin,
  readPinText,
  savePin,
  setPinClickThrough,
  togglePins,
  turnPin,
  zoomPin,
  type PinTurn,
} from "../../features/screenshot/api";
import type { PinCommand } from "../../features/screenshot/pin";
import { saveFolderOf } from "../../features/screenshot/settings";
import { loadScreenshotSettings } from "../../features/screenshot/storage";
import { useTranslation } from "../../i18n";

const TURNS: Partial<Record<PinCommand, PinTurn>> = { left: "left", right: "right", flipX: "flipX", flipY: "flipY" };

export function usePinActions(say: (text: string) => void, report: (error: unknown) => void, close: () => void, annotate: () => void) {
  const t = useTranslation().screenshot;
  const [scale, setScale] = useState(1);
  const [collapsed, setCollapsed] = useState(false);

  const zoom = useCallback((next: number, anchor = { x: 0.5, y: 0.5 }) => {
    setScale(next);
    zoomPin(next, anchor).catch(report);
  }, [report]);

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    collapsePin(next).then(() => setCollapsed(next), report);
  }, [collapsed, report]);

  const run = useCallback((command: PinCommand) => {
    const turn = TURNS[command];
    if (turn) {
      if (!collapsed) turnPin(turn).catch(report);
      return;
    }
    switch (command) {
      case "close":
        return close();
      case "copy":
        return void copyPin().then(() => say(t.pinCopied), report);
      case "save":
        return void savePin({ folder: saveFolderOf(loadScreenshotSettings()), folderName: t.saveFolderName }).then((path) => say(t.saved(path)), report);
      case "toggle":
        return void togglePins();
      case "actualSize":
        return collapsed ? undefined : zoom(1);
      case "annotate":
        return collapsed ? undefined : annotate();
      case "text":
        say(t.pinText.reading);
        return void readPinText()
          .then((text) => (text.trim() ? navigator.clipboard.writeText(text).then(() => say(t.pinText.copied)) : say(t.pinText.empty)))
          .catch(report);
      case "collapse":
        return toggleCollapsed();
    }
  }, [annotate, close, collapsed, report, say, t, toggleCollapsed, zoom]);

  const openMenu = useCallback(async () => {
    const menu = t.pinMenu;
    const item = (text: string, command: PinCommand, enabled = true) => ({ text, enabled, action: () => run(command) });
    const popup = await Menu.new({
      items: [
        item(menu.copy, "copy"),
        item(menu.save, "save"),
        item(menu.actualSize, "actualSize", scale !== 1 && !collapsed),
        { item: "Separator" },
        item(menu.annotate, "annotate", !collapsed),
        item(menu.readText, "text"),
        item(menu.turnLeft, "left", !collapsed),
        item(menu.turnRight, "right", !collapsed),
        item(menu.flipX, "flipX", !collapsed),
        item(menu.flipY, "flipY", !collapsed),
        item(collapsed ? menu.expand : menu.collapse, "collapse"),
        { item: "Separator" },
        { text: menu.clickThrough, action: () => void setPinClickThrough(true).catch(report) },
        item(menu.hideAll, "toggle"),
        { item: "Separator" },
        item(menu.close, "close"),
        { text: menu.closeAll, action: () => void closeAllPins() },
      ],
    });
    await popup.popup().catch(report);
  }, [collapsed, report, run, scale, t]);

  return { scale, zoom, collapsed, run, openMenu };
}
