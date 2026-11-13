import { pluginIconTone, pluginInitial } from "./marketGroups";
import type { PluginHealth } from "./installedFilter";
import "./PluginIcon.css";

export function PluginIcon({
  id,
  name,
  categories = [],
  size = "md",
  health,
  healthLabel,
  className,
}: {
  id: string;
  name: string;
  categories?: string[];
  size?: "md" | "lg";
  health?: PluginHealth;
  healthLabel?: string;
  className?: string;
}) {
  const classes = ["plugin-icon", `plugin-icon--${size}`, `plugin-icon--${pluginIconTone({ id, categories })}`, className].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden={healthLabel ? undefined : true}>
      <span aria-hidden="true">{pluginInitial(name)}</span>
      {health ? <i className={`plugin-icon__dot plugin-icon__dot--${health}`} role={healthLabel ? "img" : undefined} aria-label={healthLabel} /> : null}
    </span>
  );
}
