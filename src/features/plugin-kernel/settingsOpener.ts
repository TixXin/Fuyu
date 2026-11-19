type SettingsOpener = (plugin: string) => Promise<void>;

let opener: SettingsOpener | null = null;

export function setPluginSettingsOpener(next: SettingsOpener | null) {
  opener = next;
}

export function openPluginSettings(plugin: string): Promise<void> {
  if (!opener) return Promise.reject(Object.assign(new Error("this window cannot open the settings"), { code: "not-ready" }));
  return opener(plugin);
}
