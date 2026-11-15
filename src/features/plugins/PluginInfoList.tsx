import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { copyPluginInfo, type PluginInfoItem } from "./api";

export function PluginInfoList({ items, pluginId }: { items: PluginInfoItem[]; pluginId?: string }) {
  const t = useTranslation();
  const { locale } = useLocale();
  const [copied, setCopied] = useState<number | null>(null);

  const copy = (index: number, item: PluginInfoItem) => {
    const write = item.secret && pluginId ? copyPluginInfo(pluginId, index) : navigator.clipboard.writeText(item.value);
    void write.then(() => {
      setCopied(index);
      window.setTimeout(() => setCopied((current) => (current === index ? null : current)), 1500);
    });
  };

  return (
    <div className="plugin-info">
      {items.map((item, index) => (
        <div className="plugin-info__row" key={`${item.label.en}-${index}`}>
          <span>{item.label[locale]}</span>
          <code>{item.secret ? (item.hasValue ? "•".repeat(12) : "") : item.value}</code>
          {item.copy && (!item.secret || (item.hasValue && pluginId)) ? (
            <button className="plugin-card__button" type="button" onClick={() => copy(index, item)}>
              {copied === index ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.4} />}
              <span>{copied === index ? t.settings.plugins.detail.copied : t.settings.plugins.detail.copy}</span>
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
