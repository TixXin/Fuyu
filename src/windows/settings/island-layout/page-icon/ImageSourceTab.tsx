import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ImageUp, Wand2 } from "lucide-react";
import type { PanelIconComponent } from "../../../../components/island-widget/panelIcons";
import { SettingsChoice } from "../../../../components/settings/SettingsChoice";
import { useTranslation } from "../../../../i18n";
import { PAGE_ICON_IMAGES_MAX, type PageIconImage } from "../../../../lib/settings/pageIconStore";
import { ImageCropper } from "./ImageCropper";
import { ImageLibrary } from "./ImageLibrary";
import type { CellHandlers } from "./IconCell";
import { clampZoom, importImage, initialCrop, renderIconPng, svgBlob, ZOOM_RANGE, type CropState, type ImageShape, type ImportedImage } from "./imageImport";
import "./ImageSourceTab.css";

const SITES = [
  ["Lucide", "https://lucide.dev/icons/"],
  ["Tabler", "https://tabler.io/icons"],
  ["Iconify", "https://icon-sets.iconify.design/"],
  ["Phosphor", "https://phosphoricons.com/"],
] as const;

export type ImageDraft = { data: string; mono: boolean };
export type IncomingImage = { source: Blob | string; nonce: number };
export type ImageError = "badType" | "tooBig" | "unreadable" | "remote" | "full" | "saveFailed";

type ImageSourceTabProps = CellHandlers & {
  pageName: string;
  images: readonly PageIconImage[];
  incoming: IncomingImage | null;
  glyph: (value: string) => PanelIconComponent;
  onDraft: (draft: ImageDraft | null) => void;
  onUse: (draft: ImageDraft) => ImageError | null;
  onDelete: (id: string) => void;
  onIncomingTaken: () => void;
};

type Editing = ImportedImage & { crop: CropState; mono: boolean };

export function ImageSourceTab({ pageName, images, incoming, glyph, onDraft, onUse, onDelete, onIncomingTaken, ...cell }: ImageSourceTabProps) {
  const text = useTranslation().settings.islandPages.icons.picker.image;
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<ImageError | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (source: Blob | string) => {
    setError(null);
    const result = await importImage(typeof source === "string" ? svgBlob(source) : source);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    setEditing({ ...result, crop: initialCrop(result.kind), mono: result.kind !== "photo" });
  }, []);

  useEffect(() => {
    if (!incoming) return;
    onIncomingTaken();
    void load(incoming.source);
  }, [incoming, load, onIncomingTaken]);

  const image = editing?.image;
  const cropState = editing?.crop;
  const draft = useMemo(() => (image && cropState ? renderIconPng(image, cropState) : null), [image, cropState]);
  const mono = editing?.mono ?? false;
  useEffect(() => {
    onDraft(draft ? { data: draft, mono } : null);
  }, [draft, mono, onDraft]);
  useEffect(() => () => onDraft(null), [onDraft]);

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/")) ?? event.dataTransfer.files[0];
    if (file) {
      void load(file);
      return;
    }
    const markup = event.dataTransfer.getData("text/plain");
    if (markup.trim().startsWith("<svg")) void load(markup);
    else if (event.dataTransfer.getData("text/uri-list")) setError("remote");
  };
  const change = (patch: Partial<Editing>) => setEditing((previous) => (previous ? { ...previous, ...patch } : previous));
  const crop = (patch: Partial<CropState>) => setEditing((previous) => (previous ? { ...previous, crop: { ...previous.crop, ...patch } } : previous));
  const shapes: ImageShape[] = ["none", "circle", "round"];

  return (
    <div className="page-icon-tab" onDragOver={(event) => {
      event.preventDefault();
      setOver(true);
    }} onDragLeave={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    }} onDrop={drop}>
      <button className="page-icon-drop" type="button" data-over={over || undefined} onClick={() => fileRef.current?.click()}>
        <span className="page-icon-drop__mark" aria-hidden="true"><ImageUp size={22} strokeWidth={1.7} /></span>
        <span className="page-icon-drop__text">
          <strong>{over ? text.dropHere : text.drop}</strong>
          <span>{text.formats}</span>
        </span>
      </button>
      <p className="page-icon-note">
        {text.where}
        {SITES.map(([name, url], index) => (
          <span key={name}>
            {index > 0 ? " · " : null}
            <a href={url} target="_blank" rel="noreferrer">{name}</a>
          </span>
        ))}
        {text.copySvg}
      </p>
      <input ref={fileRef} type="file" hidden accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void load(file);
      }} />
      {error ? <p className="page-icon-note page-icon-note--warn" role="alert">{error === "full" ? text.full(PAGE_ICON_IMAGES_MAX) : text[error]}</p> : null}
      {editing ? (
        <div className="page-icon-editor">
          <ImageCropper image={editing.image} crop={editing.crop} tip={text.dragTip} onChange={(next) => change({ crop: next })} />
          <div className="page-icon-editor__options">
            <p className="page-icon-auto"><Wand2 size={13} strokeWidth={1.8} aria-hidden="true" />{text.auto[editing.kind]}</p>
            <div className="page-icon-option">
              <span>{text.display}</span>
              <SettingsChoice value={editing.mono ? "mono" : "color"} ariaLabel={text.display} options={[{ value: "mono", label: text.mono }, { value: "color", label: text.color }]} onChange={(next) => change({ mono: next === "mono" })} />
            </div>
            <div className="page-icon-option">
              <span>{text.shape}</span>
              <SettingsChoice value={editing.crop.shape} ariaLabel={text.shape} options={shapes.map((shape) => ({ value: shape, label: text.shapes[shape] }))} onChange={(shape) => crop(shape === "none" ? { shape } : { shape, cover: true })} />
            </div>
            <label className="page-icon-option">
              <span>{text.zoom}</span>
              <input type="range" min={ZOOM_RANGE.min} max={ZOOM_RANGE.max} step={0.01} value={editing.crop.zoom} onChange={(event) => crop({ zoom: clampZoom(Number(event.currentTarget.value)) })} />
            </label>
            <div className="page-icon-editor__actions">
              <button className="page-icon-primary" type="button" disabled={!draft} onClick={() => {
                if (!draft) return;
                const failed = onUse({ data: draft, mono: editing.mono });
                if (failed) setError(failed);
                else setEditing(null);
              }}>{text.use(pageName)}</button>
              <button className="page-icon-link" type="button" onClick={() => setEditing(null)}>{text.cancel}</button>
            </div>
          </div>
        </div>
      ) : null}
      <ImageLibrary images={images} glyph={glyph} onDelete={onDelete} {...cell} />
    </div>
  );
}
