import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { pinNoteImage, readNoteImage } from "../api";
import { noteImagePaths } from "../noteImages";
import "./TodoNoteImages.css";

const cache = new Map<string, string | null>();

function NoteImage({ path }: { path: string }) {
  const t = useTranslation().todoIsland;
  const [src, setSrc] = useState<string | null | undefined>(cache.get(path));

  useEffect(() => {
    if (cache.has(path)) {
      setSrc(cache.get(path));
      return;
    }
    let live = true;
    readNoteImage(path).then(
      (image) => {
        cache.set(path, image);
        if (live) setSrc(image);
      },
      () => live && setSrc(null),
    );
    return () => {
      live = false;
    };
  }, [path]);

  if (src === null) {
    return (
      <span className="todo-note-images__item todo-note-images__item--gone" title={t.noteImageGone}>
        <ImageOff size={14} aria-hidden="true" />
      </span>
    );
  }
  return (
    <button type="button" className="todo-note-images__item" title={t.noteImagePin} aria-label={t.noteImagePin} onClick={() => void pinNoteImage(path).catch(() => undefined)}>
      {src && <img src={src} alt="" draggable={false} />}
    </button>
  );
}

export function TodoNoteImages({ text }: { text: string | null | undefined }) {
  const paths = noteImagePaths(text);
  if (paths.length === 0) return null;
  return (
    <div className="todo-note-images">
      {paths.map((path) => (
        <NoteImage key={path} path={path} />
      ))}
    </div>
  );
}
