type Names = { zh: string; en: string };

const NAMES: Readonly<Record<string, Names>> = {
  "NetEase Music": { zh: "网易云音乐", en: "NetEase Cloud Music" },
  "QQ Music": { zh: "QQ音乐", en: "QQ Music" },
  KuGou: { zh: "酷狗音乐", en: "KuGou Music" },
  Kuwo: { zh: "酷我音乐", en: "Kuwo Music" },
  汽水音乐: { zh: "汽水音乐", en: "Soda Music" },
  咪咕音乐: { zh: "咪咕音乐", en: "Migu Music" },
};

export function playerName(label: string, locale: string): string {
  const names = NAMES[label.trim()];
  if (!names) return label;
  return locale.toLowerCase().startsWith("zh") ? names.zh : names.en;
}
