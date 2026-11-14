import { useState } from "react";
import { clipboardImageUrl } from "./api";

export function ClipboardPreviewImage({ id, thumbnail }: { id: string; thumbnail?: string }) {
  const full = clipboardImageUrl(id);
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = loaded === full;
  return (
    <div className={`clipboard-picture${ready ? " clipboard-picture--ready" : ""}`}>
      {thumbnail && !ready && <img className="clipboard-picture__thumb" src={thumbnail} alt="" aria-hidden="true" />}
      <img className="clipboard-picture__full" src={full} alt="" decoding="async" onLoad={() => setLoaded(full)} />
    </div>
  );
}
