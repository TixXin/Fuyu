import { useCallback, useEffect, useRef, useState } from "react";
import { FUYU_TEXT_ICON, JELLYFISH_ICON } from "../../../../components/island-widget/pageIcons";
import { setIslandPageIcon, type IslandPagesLayout } from "../../../../lib/settings/islandPages";
import {
  loadPageIconImages,
  loadPageIconRecent,
  newPageIconImageId,
  PAGE_ICON_IMAGES_MAX,
  pushPageIconRecent,
  savePageIconRecent,
  type PageIconImage,
} from "../../../../lib/settings/pageIconStore";
import { formatPageIcon, parsePageIcon } from "../../../../lib/settings/pageIconValue";
import { usePageIconImages, writePageIconImages } from "../../../../lib/settings/usePageIconImages";
import type { ImageDraft, ImageError } from "./ImageSourceTab";

export const DEFAULT_ICON = "";
const UNDO_MS = 6000;

type Options = { pageId: string; fuyu: boolean; layout: IslandPagesLayout; save: (layout: IslandPagesLayout) => void; legacyJellyfish: boolean };
export type Undo = { pages: string[]; restore: () => void };

const remembered = (value: string) => value !== DEFAULT_ICON && value !== FUYU_TEXT_ICON && value !== JELLYFISH_ICON && parsePageIcon(value)?.kind !== "text";

export function usePageIconPicker({ pageId, fuyu, layout, save, legacyJellyfish }: Options) {
  const images = usePageIconImages();
  const [recentAll, setRecent] = useState(loadPageIconRecent);
  const [undo, setUndo] = useState<Undo | null>(null);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const choose = useCallback((value: string) => {
    const keep = value === DEFAULT_ICON || (fuyu && value === FUYU_TEXT_ICON && !legacyJellyfish);
    save(setIslandPageIcon(layoutRef.current, pageId, keep ? null : value));
    if (!remembered(value)) return;
    setRecent((previous) => {
      const next = pushPageIconRecent(previous, value);
      savePageIconRecent(next);
      return next;
    });
  }, [fuyu, legacyJellyfish, pageId, save]);

  const addImage = useCallback((draft: ImageDraft): ImageError | null => {
    if (images.length >= PAGE_ICON_IMAGES_MAX) return "full";
    const image: PageIconImage = { id: newPageIconImageId(), data: draft.data, mono: draft.mono };
    if (!writePageIconImages([...images, image])) return "saveFailed";
    choose(formatPageIcon({ kind: "image", id: image.id }));
    return null;
  }, [choose, images]);

  const deleteImage = useCallback((id: string) => {
    const value = formatPageIcon({ kind: "image", id });
    const index = images.findIndex((image) => image.id === id);
    const removed = images[index];
    if (!removed) return;
    const pages = Object.entries(layoutRef.current.icons ?? {}).filter(([, icon]) => icon === value).map(([page]) => page);
    writePageIconImages(images.filter((image) => image.id !== id));
    save(pages.reduce((next, page) => setIslandPageIcon(next, page, null), layoutRef.current));
    setUndo({
      pages,
      restore: () => {
        const now = loadPageIconImages().filter((image) => image.id !== id);
        now.splice(Math.min(index, now.length), 0, removed);
        writePageIconImages(now);
        save(pages.reduce((next, page) => setIslandPageIcon(next, page, value), layoutRef.current));
        setUndo(null);
      },
    });
  }, [images, save]);

  const recent = recentAll.filter((value) => {
    const parsed = parsePageIcon(value);
    return parsed?.kind !== "image" || images.some((image) => image.id === parsed.id);
  });

  return { images, recent, choose, addImage, deleteImage, undo, dismissUndo: () => setUndo(null) };
}
