import { useState } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { I18nProvider } from "../../src/i18n";
import { GlassSettingsSection } from "../../src/windows/settings/sections/GlassSettingsSection";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settingsDefaults";
import type { IslandSettings } from "../../src/lib/settings/types";

const query = new URLSearchParams(location.search);
const initial: IslandSettings = { ...DEFAULT_SETTINGS, appearanceMode: "liquidGlass", glassBackdrop: "wallpaper", ...JSON.parse(query.get("glass") ?? "{}") };

type Options = { apply: (settings: IslandSettings) => void; setWallpaper: (url: string) => void };

function showWallpaper(url: string, setWallpaper: Options["setWallpaper"]) {
  setWallpaper(url);
  document.body.style.background = `url("${url}") center / cover fixed`;
  void emit("wallpaper-changed");
}

function Playground({ apply, setWallpaper }: Options) {
  const [settings, setSettings] = useState<IslandSettings>(initial);
  const change = (next: IslandSettings) => {
    setSettings(next);
    apply(next);
  };
  return <aside style={{ position: "fixed", top: 12, right: 12, bottom: 12, width: 400, overflow: "auto", padding: 12, borderRadius: 12, background: "rgba(24, 26, 32, 0.92)", color: "#eef1f6", zIndex: 10 }}>
    <label>壁纸 <input type="file" accept="image/*" onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => showWallpaper(String(reader.result), setWallpaper);
      reader.readAsDataURL(file);
    }} /></label>
    <GlassSettingsSection settings={settings} onSettingsChange={change} />
    <pre id="playground-settings" style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(Object.fromEntries(Object.entries(settings).filter(([key]) => key.startsWith("glass"))), null, 1)}</pre>
  </aside>;
}

export function mountPlayground(options: Options) {
  const host = document.body.appendChild(document.createElement("div"));
  createRoot(host).render(<I18nProvider><Playground {...options} /></I18nProvider>);
  const url = query.get("wall");
  if (url) showWallpaper(url, options.setWallpaper);
  options.apply(initial);
}
