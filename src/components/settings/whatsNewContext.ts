import { createContext, useContext } from "react";

export type SettingsRowIdentity = {
  group?: string;
  title?: string;
};

export type SettingsWhatsNewContextValue = {
  isNew: (since?: string, row?: SettingsRowIdentity) => boolean;
};

const INACTIVE: SettingsWhatsNewContextValue = {
  isNew: () => false,
};

export const SettingsWhatsNewContext = createContext<SettingsWhatsNewContextValue>(INACTIVE);

export function useSettingsWhatsNew(): SettingsWhatsNewContextValue {
  return useContext(SettingsWhatsNewContext);
}
