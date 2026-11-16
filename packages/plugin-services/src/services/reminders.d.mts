import type { ServiceDefinition } from "../define.mjs";

export type ReminderIcon = "stand" | "eye" | "water" | "stretch" | "coffee" | "bell" | "flag";

export type Reminder = {
  id: string;
  source: string;
  icon: ReminderIcon;
  title: string;
  detail?: string;
  snoozable?: boolean;
};

export type RemindersMethods = {
  push(params: Reminder): { shown: boolean };
};

export const remindersV1: ServiceDefinition<RemindersMethods, {}, {}>;
