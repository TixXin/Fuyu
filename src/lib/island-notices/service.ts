import { defineService } from "@fuyu/plugin-base/services";

export type IslandNotice = {
  pluginId: string;
  pluginName: { "zh-CN": string; en: string } | null;
  title: string;
  body: string;
  durationMs: number;
  actions: { id: string; title: string }[];
  icon?: "plugin" | "media";
  layout?: "card" | "inline";
  controls?: "none" | "media";
  iconUrl?: string | null;
};

export type IslandNoticeAction = { pluginId: string; action: string };

type Methods = { notify(params: IslandNotice): { shown: boolean } };

type Events = { action: IslandNoticeAction };

export const islandNoticesV1 = defineService<Methods, Events>("island-notices/v1", {
  methods: { notify: true },
  events: { action: true },
});
