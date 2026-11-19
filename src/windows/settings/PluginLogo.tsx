import { useState, type ReactNode } from "react";
import { useMarketImage } from "./marketImages";
import { pluginInitial } from "./pluginIconSources";

export function PluginLogo({ sources, title, size, dim, children }: {
  sources: readonly string[];
  title: string;
  size?: "sm" | "lg";
  dim?: boolean;
  children?: ReactNode;
}) {
  const key = sources.join("\n");
  const [failed, setFailed] = useState<{ key: string; count: number }>({ key, count: 0 });
  const count = failed.key === key ? failed.count : 0;
  const source = sources[count];
  const src = useMarketImage(source);
  const className = ["plugin-icon", size ? `plugin-icon--${size}` : "", dim ? "plugin-icon--dim" : "", source ? "plugin-icon--img" : ""].filter(Boolean).join(" ");
  return (
    <span className={className} aria-hidden="true">
      {source
        ? src && <img className="plugin-icon__img" src={src} alt="" draggable={false} onError={() => setFailed({ key, count: count + 1 })} />
        : pluginInitial(title)}
      {children}
    </span>
  );
}
