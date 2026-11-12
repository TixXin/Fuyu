import type { LocalizedText, PluginInfo } from "./api.ts";

export type PluginShortcutRow = {
  key: string;
  pluginId: string;
  pluginName: LocalizedText;
  commandId: string;
  title: LocalizedText;
  defaultShortcut: string | null;
  shortcut: string | null;
  changed: boolean;
};

export function effectiveShortcut(defaultShortcut: string | null, user: string | undefined) {
  if (user === undefined) return defaultShortcut;
  return user === "" ? null : user;
}

export function pluginShortcutRows(plugins: readonly PluginInfo[]): PluginShortcutRow[] {
  return plugins
    .filter((plugin) => (plugin.enabled || plugin.dev) && !plugin.builtin && !plugin.invalidReason && plugin.hasProcess && plugin.name)
    .flatMap((plugin) =>
      plugin.commands.map((command) => {
        const defaultShortcut = command.keybinding ?? null;
        const user = plugin.keybindings?.[command.id];
        return {
          key: `plugin:${plugin.id}/${command.id}`,
          pluginId: plugin.id,
          pluginName: plugin.name as LocalizedText,
          commandId: command.id,
          title: command.title,
          defaultShortcut,
          shortcut: effectiveShortcut(defaultShortcut, user),
          changed: user !== undefined,
        };
      }),
    );
}
