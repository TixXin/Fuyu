type Names = { zh: string; en: string };

const NAMES: Readonly<Record<string, Names>> = {
  "NetEase Music": { zh: "网易云音乐", en: "NetEase Cloud Music" },
  "QQ Music": { zh: "QQ音乐", en: "QQ Music" },
  KuGou: { zh: "酷狗音乐", en: "KuGou Music" },
  Kuwo: { zh: "酷我音乐", en: "Kuwo Music" },
  汽水音乐: { zh: "汽水音乐", en: "Soda Music" },
  咪咕音乐: { zh: "咪咕音乐", en: "Migu Music" },
  "LX Music": { zh: "洛雪音乐", en: "LX Music" },
  "Salt Player": { zh: "椒盐音乐", en: "Salt Player" },
  "HiBy Music": { zh: "海贝音乐", en: "HiBy Music" },
  音流: { zh: "音流", en: "Stream Music" },
  铜钟: { zh: "铜钟", en: "Tongzhong" },
  Groove: { zh: "Groove 音乐", en: "Groove Music" },
};

export function playerName(label: string, locale: string): string {
  const names = NAMES[label.trim()];
  if (!names) return label;
  return locale.toLowerCase().startsWith("zh") ? names.zh : names.en;
}
