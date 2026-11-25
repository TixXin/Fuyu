import { createContext, useContext } from "react";

export type SettingsWhatsNewContextValue = {
  isNew: (since?: string) => boolean;
};

const INACTIVE: SettingsWhatsNewContextValue = {
  isNew: () => false,
};

export const SettingsWhatsNewContext = createContext<SettingsWhatsNewContextValue>(INACTIVE);

export function useSettingsWhatsNew(): SettingsWhatsNewContextValue {
  return useContext(SettingsWhatsNewContext);
}
