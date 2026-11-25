import type { ReleaseNoteLine } from "../../features/updater/releaseNotes";
import type { DirectorSceneId } from "./directorScenes";

export type ReleaseSectionTheme = "jellyfish" | "agent" | "wing" | "panel" | "appearance" | "fix" | "general";

export type ReleaseHighlightItem = {
  title: string;
  detail: string;
  raw: string;
};

export type ReleaseShowcaseSection = {
  id: string;
  heading: string;
  theme: ReleaseSectionTheme;
  demoScene: DirectorSceneId | null;
  items: ReleaseHighlightItem[];
};

export type ReleaseAutoGroupLabels = {
  general: string;
  agent: string;
  panel: string;
  appearance: string;
  wing: string;
  fix: string;
};

const COLON_SPLIT = /^([^：:]{2,36})[：:]\s*(.+)$/;
const INLINE_SECTION_HEADING = /^(修复|问题修复|改进|优化|其他|新增|fixes?|bug\s*fixes?|improvements?|other)[：:]$/i;

export function classifyReleaseTheme(heading: string): ReleaseSectionTheme {
  const text = heading.toLowerCase();
  if (/水母|jellyfish/.test(text)) return "jellyfish";
  if (/侧翼|分流|side.?dock|wing/.test(text)) return "wing";
  if (/agent|代理|claude|codex|antigravity|额度|审批|通知/.test(text)) return "agent";
  if (/面板|翻页|组件|刘海|panel|widget|layout|布局|notch/.test(text)) return "panel";
  if (/外观|样式|字体|主题|玻璃|形态|theme|font|glass|appearance|form/.test(text)) return "appearance";
  if (/修复|优化|性能|细节|fix|bug|perf|polish/.test(text)) return "fix";
  return "general";
}

export function demoSceneForTheme(theme: ReleaseSectionTheme): DirectorSceneId | null {
  if (theme === "agent") return "agentApproval";
  if (theme === "wing") return "sideSplit";
  if (theme === "panel" || theme === "jellyfish") return "dashboard";
  if (theme === "appearance") return "formPill";
  return null;
}

export function splitHighlightItem(raw: string): ReleaseHighlightItem {
  const clean = raw.trim();
  const match = clean.match(COLON_SPLIT);
  if (match) {
    return { title: match[1].trim(), detail: match[2].trim(), raw: clean };
  }
  return { title: "", detail: clean, raw: clean };
}

function autoGroupFlatSection(
  items: ReleaseHighlightItem[],
  labels: ReleaseAutoGroupLabels,
): ReleaseShowcaseSection[] {
  const buckets = new Map<ReleaseSectionTheme, ReleaseHighlightItem[]>();
  const order: ReleaseSectionTheme[] = [];
  for (const item of items) {
    const theme = classifyReleaseTheme(item.title || item.raw);
    const key: ReleaseSectionTheme = theme === "jellyfish" ? "appearance" : theme;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }
  const headingFor = (theme: ReleaseSectionTheme) => {
    if (theme === "agent") return labels.agent;
    if (theme === "wing") return labels.wing;
    if (theme === "panel") return labels.panel;
    if (theme === "appearance") return labels.appearance;
    if (theme === "fix") return labels.fix;
    return labels.general;
  };
  return order.map((theme, idx) => ({
    id: `auto-${idx}-${theme}`,
    heading: headingFor(theme),
    theme,
    demoScene: demoSceneForTheme(theme),
    items: buckets.get(theme)!,
  }));
}

export function parseReleaseShowcase(
  lines: readonly ReleaseNoteLine[],
  labels: ReleaseAutoGroupLabels,
): ReleaseShowcaseSection[] {
  const sections: ReleaseShowcaseSection[] = [];
  let current: ReleaseShowcaseSection | null = null;
  let hasExplicitHeadings = false;

  const ensureSection = (heading: string) => {
    const clean = heading.trim().replace(/[：:]$/, "") || labels.general;
    const theme = classifyReleaseTheme(clean);
    const created: ReleaseShowcaseSection = {
      id: `sec-${sections.length}`,
      heading: clean,
      theme,
      demoScene: demoSceneForTheme(theme),
      items: [],
    };
    sections.push(created);
    current = created;
  };

  for (const line of lines) {
    if (line.kind === "heading") {
      hasExplicitHeadings = true;
      ensureSection(line.text);
      continue;
    }
    const text = line.text.trim();
    if (!text) continue;
    if (INLINE_SECTION_HEADING.test(text)) {
      ensureSection(text);
      continue;
    }
    if (!current) ensureSection(labels.general);
    current!.items.push(splitHighlightItem(text));
  }

  const nonEmpty = sections.filter((section) => section.items.length > 0);
  if (!hasExplicitHeadings && nonEmpty.length > 0 && nonEmpty[0].theme === "general" && nonEmpty[0].items.length >= 4) {
    const [first, ...rest] = nonEmpty;
    const grouped = autoGroupFlatSection(first.items, labels);
    if (grouped.length > 1) {
      return [...grouped, ...rest];
    }
  }
  return nonEmpty;
}
