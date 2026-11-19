import { clamp } from "../../utils/number.ts";
import { getColorSetting } from "../../utils/color.ts";
import { normalizeLyricsSettings } from "./lyricsSettings.ts";
import { normalizeCalendarSettings } from "./calendarSettings.ts";
import { normalizeTodoProjects } from "../todo-projects/prefix.ts";
import { DEFAULT_PAGE_NEXT_SHORTCUT, DEFAULT_PAGE_PREVIOUS_SHORTCUT, normalizePageCycleShortcut, normalizePageDigitModifiers } from "./pageShortcuts.ts";
import { DEFAULT_SETTINGS, LEGACY_FALLBACKS } from "./settingsDefaults.ts";
import {
  MAX_AUTO_TUCK_RETRACT_DELAY_MS, MAX_HOVER_COLLAPSE_DELAY_MS, MAX_HOVER_EXPAND_DELAY_MS, MAX_HOVER_SWITCH_DELAY_MS, MAX_IDLE_DIM_OPACITY, MAX_SHELF_ITEMS,
  MIN_AUTO_TUCK_RETRACT_DELAY_MS, MIN_HOVER_COLLAPSE_DELAY_MS, MIN_HOVER_EXPAND_DELAY_MS, MIN_HOVER_SWITCH_DELAY_MS, MIN_IDLE_DIM_OPACITY, MIN_SHELF_ITEMS,
  MESSAGE_NOTICES, MESSAGE_PANEL_SECONDS, SHELF_CLEANUP_DAYS, TUCK_HINT_COLORS, TUCK_HINT_STYLES, TUCK_STYLES, oneOf,
} from "./settingsLimits.ts";
import type { IslandSettings, LegacyIslandSettings } from "./types";

export function normalizeBehaviorSettings(settings: LegacyIslandSettings | null | undefined) {
  return {
    idleDim: settings?.idleDim === true,
    idleDimSeconds: typeof settings?.idleDimSeconds === "number" && Number.isFinite(settings.idleDimSeconds)
      ? clamp(Math.round(settings.idleDimSeconds), 1, 3_600)
      : DEFAULT_SETTINGS.idleDimSeconds,
    idleDimOpacity: typeof settings?.idleDimOpacity === "number" && Number.isFinite(settings.idleDimOpacity)
      ? clamp(Math.round(settings.idleDimOpacity), MIN_IDLE_DIM_OPACITY, MAX_IDLE_DIM_OPACITY)
      : DEFAULT_SETTINGS.idleDimOpacity,
    showIdleTodoCount:
      typeof settings?.showIdleTodoCount === "boolean"
        ? settings.showIdleTodoCount
        : DEFAULT_SETTINGS.showIdleTodoCount,
    carryOverIncompleteTodos:
      typeof settings?.carryOverIncompleteTodos === "boolean"
        ? settings.carryOverIncompleteTodos
        : LEGACY_FALLBACKS.carryOverIncompleteTodos,
    enableTodoReorder:
      typeof settings?.enableTodoReorder === "boolean"
        ? settings.enableTodoReorder
        : DEFAULT_SETTINGS.enableTodoReorder,
    todoProjects: normalizeTodoProjects(settings?.todoProjects),
    rotateTodos: settings?.rotateTodos === true,
    todoRotationSeconds: typeof settings?.todoRotationSeconds === "number" && Number.isFinite(settings.todoRotationSeconds)
      ? clamp(Math.round(settings.todoRotationSeconds), 1, 3_600)
      : DEFAULT_SETTINGS.todoRotationSeconds,
    autoTuck: settings?.autoTuck === true,
    autoTuckSeconds: typeof settings?.autoTuckSeconds === "number" && Number.isFinite(settings.autoTuckSeconds)
      ? clamp(Math.round(settings.autoTuckSeconds), 1, 3_600)
      : LEGACY_FALLBACKS.autoTuckSeconds,
    autoTuckHoldTodo: settings?.autoTuckHoldTodo !== false,
    autoTuckHoldAgent: settings?.autoTuckHoldAgent !== false,
    autoTuckHoldMusic: settings?.autoTuckHoldMusic === true,
    autoTuckHoldMessages: settings?.autoTuckHoldMessages !== false,
    autoTuckRetract: settings?.autoTuckRetract !== false,
    autoTuckRetractDelayMs: typeof settings?.autoTuckRetractDelayMs === "number" && Number.isFinite(settings.autoTuckRetractDelayMs)
      ? clamp(Math.round(settings.autoTuckRetractDelayMs), MIN_AUTO_TUCK_RETRACT_DELAY_MS, MAX_AUTO_TUCK_RETRACT_DELAY_MS)
      : DEFAULT_SETTINGS.autoTuckRetractDelayMs,
    revealOnMessage: settings?.revealOnMessage !== false,
    messageNotice: oneOf(MESSAGE_NOTICES, settings?.messageNotice, LEGACY_FALLBACKS.messageNotice),
    messagePanelSeconds: oneOf(MESSAGE_PANEL_SECONDS, settings?.messagePanelSeconds, DEFAULT_SETTINGS.messagePanelSeconds),
    expandTrigger: settings?.expandTrigger === "hover" ? "hover" : "click",
    clickCollapseOnLeave: settings?.clickCollapseOnLeave === true,
    hoverExpandDelayMs: typeof settings?.hoverExpandDelayMs === "number" && Number.isFinite(settings.hoverExpandDelayMs)
      ? clamp(Math.round(settings.hoverExpandDelayMs), MIN_HOVER_EXPAND_DELAY_MS, MAX_HOVER_EXPAND_DELAY_MS)
      : LEGACY_FALLBACKS.hoverExpandDelayMs,
    hoverCollapseDelayMs: typeof settings?.hoverCollapseDelayMs === "number" && Number.isFinite(settings.hoverCollapseDelayMs)
      ? clamp(Math.round(settings.hoverCollapseDelayMs), MIN_HOVER_COLLAPSE_DELAY_MS, MAX_HOVER_COLLAPSE_DELAY_MS)
      : LEGACY_FALLBACKS.hoverCollapseDelayMs,
    hoverSwitchPage: settings?.hoverSwitchPage === true,
    hoverSwitchDelayMs: typeof settings?.hoverSwitchDelayMs === "number" && Number.isFinite(settings.hoverSwitchDelayMs)
      ? clamp(Math.round(settings.hoverSwitchDelayMs), MIN_HOVER_SWITCH_DELAY_MS, MAX_HOVER_SWITCH_DELAY_MS)
      : DEFAULT_SETTINGS.hoverSwitchDelayMs,
    minimizeAction: settings?.minimizeAction === "tuck" ? "tuck" : "tray",
    tuckedHoverAction: settings?.tuckedHoverAction === "expand" ? "expand" : "reveal",
    tuckStyle: oneOf(TUCK_STYLES, settings?.tuckStyle, DEFAULT_SETTINGS.tuckStyle),
    tuckHintStyle: oneOf(TUCK_HINT_STYLES, settings?.tuckHintStyle, DEFAULT_SETTINGS.tuckHintStyle),
    tuckHintColor: oneOf(TUCK_HINT_COLORS, settings?.tuckHintColor, DEFAULT_SETTINGS.tuckHintColor),
    tuckHintCustomColor: getColorSetting(settings?.tuckHintCustomColor, DEFAULT_SETTINGS.tuckHintCustomColor),
    tuckHintBreathe: settings?.tuckHintBreathe === true,
    pageDigitModifiers: normalizePageDigitModifiers(settings?.pageDigitModifiers),
    pageNextShortcut: normalizePageCycleShortcut(settings?.pageNextShortcut, DEFAULT_PAGE_NEXT_SHORTCUT),
    pagePreviousShortcut: normalizePageCycleShortcut(settings?.pagePreviousShortcut, DEFAULT_PAGE_PREVIOUS_SHORTCUT),
    islandLayerShortcut: typeof settings?.islandLayerShortcut === "string" ? settings.islandLayerShortcut.trim() : DEFAULT_SETTINGS.islandLayerShortcut,
    todoEnabled: settings?.todoEnabled !== false,
    musicEnabled: settings?.musicEnabled !== false,
    agentStatusEnabled: settings?.agentStatusEnabled !== false,
    agentTitleEnabled: settings?.agentTitleEnabled !== false,
    agentTitleMode: settings?.agentTitleMode === "running" ? "running" : "changes",
    agentLightStyle: settings?.agentLightStyle === "dot" ? "dot" : "mark",
    shelfEnabled: settings?.shelfEnabled !== false,
    translationEnabled: settings?.translationEnabled !== false,
    translationTarget: settings?.translationTarget === "island" ? "island" : "window",
    screenshotEnabled: settings?.screenshotEnabled === true,
    screenshotGuides: settings?.screenshotGuides !== false,
    shelfExpandOnDrop: settings?.shelfExpandOnDrop !== false,
    shelfAutoCleanupDays: oneOf(SHELF_CLEANUP_DAYS, settings?.shelfAutoCleanupDays, DEFAULT_SETTINGS.shelfAutoCleanupDays),
    shelfRemoveMissing: settings?.shelfRemoveMissing === true,
    shelfRemoveAfterDragOut: settings?.shelfRemoveAfterDragOut === true,
    shelfMaxItems: typeof settings?.shelfMaxItems === "number" && Number.isFinite(settings.shelfMaxItems)
      ? clamp(Math.round(settings.shelfMaxItems), MIN_SHELF_ITEMS, MAX_SHELF_ITEMS)
      : DEFAULT_SETTINGS.shelfMaxItems,
    shelfDoubleClick: settings?.shelfDoubleClick === "reveal" ? "reveal" : "open",
    shelfShowCount: settings?.shelfShowCount === true,
    sideMusicCover: settings?.sideMusicCover === true,
    deviceUseIndicator: settings?.deviceUseIndicator !== false,
    levelPopup: settings?.levelPopup !== false,
    deviceAlerts: settings?.deviceAlerts !== false,
    ...normalizeLyricsSettings(settings),
    ...normalizeCalendarSettings(settings),
    mailEnabled: settings?.mailEnabled !== false,
    gameDoNotDisturb: typeof settings?.gameDoNotDisturb === "boolean" ? settings.gameDoNotDisturb : DEFAULT_SETTINGS.gameDoNotDisturb,
    gameAutoTuck: typeof settings?.gameAutoTuck === "boolean" ? settings.gameAutoTuck : DEFAULT_SETTINGS.gameAutoTuck,
    hoverTakesKeyboard: settings?.hoverTakesKeyboard === true,
  } satisfies Partial<IslandSettings>;
}
