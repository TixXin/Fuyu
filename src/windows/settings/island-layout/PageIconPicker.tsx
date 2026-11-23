import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { Image as ImageIcon, Shapes, Smile, Type, X, type LucideIcon } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import type { PanelIconComponent } from "../../../components/island-widget/panelIcons";
import { FUYU_TEXT_ICON, JELLYFISH_ICON, PAGE_ICON_CHOICES, pageIconComponent } from "../../../components/island-widget/pageIcons";
import { useTranslation } from "../../../i18n";
import { FUYU_PAGE_ID } from "../../../lib/settings/customPanels";
import type { IslandPagesLayout } from "../../../lib/settings/islandPages";
import { parsePageIcon } from "../../../lib/settings/pageIconValue";
import { EmojiSourceTab } from "./page-icon/EmojiSourceTab";
import { IconSourceTab } from "./page-icon/IconSourceTab";
import { clipboardImage } from "./page-icon/imageImport";
import { ImageSourceTab, type ImageDraft, type IncomingImage } from "./page-icon/ImageSourceTab";
import { PageIconStage } from "./page-icon/PageIconStage";
import { PAGE_ICON_SOURCES, sourceOf, type PageIconSource } from "./page-icon/pageIconSources";
import { TextSourceTab } from "./page-icon/TextSourceTab";
import { DEFAULT_ICON, usePageIconPicker } from "./page-icon/usePageIconPicker";
import type { IslandPageRow } from "./useIslandPageRows";
import "./PageIconPicker.css";

const SOURCE_ICONS: Record<PageIconSource, LucideIcon> = { icon: Shapes, emoji: Smile, text: Type, image: ImageIcon };
const RECOMMENDED = Object.keys(PAGE_ICON_CHOICES);

type PageIconPickerProps = {
  row: IslandPageRow;
  layout: IslandPagesLayout;
  save: (layout: IslandPagesLayout) => void;
  legacyJellyfish: boolean;
  nameOf: (id: string) => string;
};

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function PageIconPicker({ row, layout, save, legacyJellyfish, nameOf }: PageIconPickerProps) {
  const text = useTranslation().settings.islandPages.icons;
  const picker = text.picker;
  const fuyu = row.id === FUYU_PAGE_ID;
  const current = row.iconName ?? DEFAULT_ICON;
  const { images, recent, choose, addImage, deleteImage, undo, dismissUndo } = usePageIconPicker({ pageId: row.id, fuyu, layout, save, legacyJellyfish });
  const [source, setSource] = useState<PageIconSource>(() => sourceOf(current));
  const [peek, setPeek] = useState<string | null>(null);
  const [draft, setDraft] = useState<ImageDraft | null>(null);
  const [incoming, setIncoming] = useState<IncomingImage | null>(null);

  const glyph = useCallback((value: string): PanelIconComponent => (value === DEFAULT_ICON ? row.defaultIcon : pageIconComponent(value, row.defaultIcon) ?? row.defaultIcon), [row.defaultIcon]);
  const label = (value: string) => {
    if (value === DEFAULT_ICON) return text.useDefault;
    if (value === FUYU_TEXT_ICON) return text.text;
    if (value === JELLYFISH_ICON) return text.jellyfish;
    const parsed = parsePageIcon(value);
    if (parsed?.kind === "emoji") return parsed.emoji;
    if (parsed?.kind === "text") return parsed.text;
    if (parsed?.kind === "image") return picker.image.mine;
    return text.names[value] ?? value;
  };

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (isTyping(event.target)) return;
      const found = clipboardImage(event.clipboardData);
      if (!found) return;
      event.preventDefault();
      setSource("image");
      setIncoming({ source: found, nonce: Date.now() });
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, []);

  const takeIncoming = useCallback(() => setIncoming(null), []);
  const pick = (value: string) => {
    setPeek(null);
    choose(value);
  };
  const cell = { current, tabbable: current, onPick: pick, onPeek: setPeek };
  const lead = fuyu
    ? [{ value: FUYU_TEXT_ICON, label: text.text, wide: true }, { value: JELLYFISH_ICON, label: text.jellyfish }]
    : [{ value: DEFAULT_ICON, label: text.useDefault, caption: text.useDefault }];
  const shown = draft ? current : peek ?? current;
  const using = sourceOf(current);
  const switchKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = PAGE_ICON_SOURCES[(PAGE_ICON_SOURCES.indexOf(source) + step + PAGE_ICON_SOURCES.length) % PAGE_ICON_SOURCES.length];
    setSource(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-source='${next}']`)?.focus();
  };

  return (
    <SettingsGroup title={text.title(row.name)} footer={fuyu ? text.fuyuHint : text.hint}>
      <div className="page-icon-picker" data-page={row.id}>
        <PageIconStage
          value={shown}
          icon={glyph(shown)}
          draft={draft}
          peeking={peek !== null && peek !== current && !draft}
          title={`${row.name} · ${draft ? picker.image.mine : label(shown)}`}
        />
        <div className="page-icon-sources" role="tablist" aria-label={picker.sourcesLabel} onKeyDown={switchKeys}>
          {PAGE_ICON_SOURCES.map((id) => {
            const Icon = SOURCE_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                role="tab"
                data-source={id}
                aria-selected={source === id}
                aria-controls="page-icon-panel"
                tabIndex={source === id ? 0 : -1}
                onClick={() => setSource(id)}
              >
                <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                {picker.sources[id]}
                {current !== DEFAULT_ICON && using === id ? <i className="page-icon-sources__dot" title={picker.inUse} /> : null}
              </button>
            );
          })}
        </div>
        <div id="page-icon-panel" className="page-icon-panel" role="tabpanel" key={source}>
          {source === "icon" ? (
            <IconSourceTab lead={lead} recent={recent} recommended={RECOMMENDED} glyph={glyph} label={label} onSource={setSource} {...cell} />
          ) : source === "emoji" ? (
            <EmojiSourceTab glyph={glyph} {...cell} />
          ) : source === "text" ? (
            <TextSourceTab current={current} pageName={row.name} onPick={pick} onClear={() => pick(DEFAULT_ICON)} />
          ) : (
            <ImageSourceTab pageName={row.name} images={images} incoming={incoming} glyph={glyph} onDraft={setDraft} onUse={addImage} onDelete={deleteImage} onIncomingTaken={takeIncoming} {...cell} />
          )}
        </div>
        {undo ? (
          <div className="page-icon-undo" role="status">
            <span>{undo.pages.length > 0 ? picker.image.removedUsed(undo.pages.map(nameOf)) : picker.image.removed}</span>
            <button type="button" onClick={undo.restore}>{picker.image.undo}</button>
            <button type="button" className="page-icon-undo__close" aria-label={picker.image.cancel} title={picker.image.cancel} onClick={dismissUndo}><X size={13} strokeWidth={2} aria-hidden="true" /></button>
          </div>
        ) : null}
      </div>
    </SettingsGroup>
  );
}
