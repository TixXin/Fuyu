export function samplePackage(appKey = "fuyu") {
  return {
    name: "@someone/fuyu-weather",
    version: "1.2.0",
    type: "module",
    description: "Weather on the island",
    author: { name: "someone", url: "https://example.com" },
    license: "MIT",
    homepage: "https://example.com/weather",
    repository: "github:someone/fuyu-weather",
    keywords: ["weather"],
    files: ["dist", "assets"],
    engines: { [appKey]: ">=0.4.0" },
    [appKey]: {
      manifest: 1,
      displayName: { "zh-CN": "天气", en: "Weather" },
      description: { "zh-CN": "岛上看天气", en: "Weather on the island" },
      icon: "assets/icon.png",
      categories: ["information"],
      screenshots: [{ path: "assets/forecast.png", caption: { "zh-CN": "预报", en: "Forecast" } }],
      platforms: ["windows", "macos"],
      host: "dist/host.js",
      client: { island: "dist/island.js", settings: "dist/settings.js" },
      inject: { required: ["notify"], optional: ["calendar"] },
      requires: { "@fuyu/location": "^1.0.0" },
      provides: ["weather"],
      slots: ["island.page/v1"],
      commands: [{ id: "weather.refresh", title: { "zh-CN": "刷新", en: "Refresh" }, keybinding: "Ctrl+Alt+W" }],
      network: ["api.open-meteo.com"],
      config: "dist/config.schema.json",
      nodeApis: ["fs", "http"],
      builtWith: "2.0.0",
    },
  };
}

export const withApp = (change, appKey = "fuyu") => {
  const pkg = samplePackage(appKey);
  change(pkg[appKey], pkg);
  return pkg;
};
