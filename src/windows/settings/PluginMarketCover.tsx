import { useState, type CSSProperties } from "react";
import type { MarketCatalogPlugin } from "@fuyu/plugin-services";
import { useTranslation } from "../../i18n";
import { iconTint, isStripShot } from "./marketCover";
import { MarketImage } from "./MarketImage";
import { useMarketImage } from "./marketImages";
import { iconSources } from "./pluginIconSources";
import { PluginLogo } from "./PluginLogo";

export function PluginMarketCover({ plugin, title }: { plugin: MarketCatalogPlugin; title: string }) {
  const text = useTranslation().settings.pluginsV3.marketPage.card;
  const shots = plugin.screenshots ?? [];
  const [failed, setFailed] = useState(false);
  const [strip, setStrip] = useState(false);
  const tint = iconTint(useMarketImage(plugin.icon));
  const shown = shots.length > 0 && !failed;
  return (
    <div className="market-cover" data-market-cover={shown ? shots.length : 0} data-tint={tint ?? undefined} style={tint ? ({ "--market-tint": tint } as CSSProperties) : undefined}>
      {shown ? (
        <MarketImage
          className={strip ? "market-cover__shot market-cover__shot--strip" : "market-cover__shot"}
          url={shots[0].url}
          lazy
          alt=""
          draggable={false}
          onLoad={(event) => setStrip(isStripShot(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight))}
          onError={() => setFailed(true)}
        />
      ) : (
        <PluginLogo sources={iconSources(plugin.icon)} title={title} size="lg" />
      )}
      {shown && shots.length > 1 ? <span className="market-cover__count">{text.shotCount(shots.length)}</span> : null}
    </div>
  );
}
