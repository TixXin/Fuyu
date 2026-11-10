import { useEffect, useRef, useState } from "react";
import { ANNOTATION_FONT, TEXT_LINE_HEIGHT } from "../../features/screenshot/drawAnnotations";
import type { Point } from "../../features/screenshot/selection";

/**
 * The box a text annotation is typed in, where it was clicked, in the colour and size it will be
 * drawn. Enter (or clicking away) keeps the text, Shift+Enter starts a new line, Esc drops it;
 * keys typed here never reach the overlay's own shortcuts.
 */
export function AnnotationTextInput({
  at,
  color,
  size,
  placeholder,
  onCommit,
  onCancel,
}: {
  /** CSS pixels. */
  at: Point;
  color: string;
  /** Font size in CSS pixels. */
  size: number;
  placeholder: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    // After the press that opened it is over, or the press takes the focus back.
    const timer = setTimeout(() => box.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    if (keep) onCommit(text);
    else onCancel();
  };

  const lines = Math.max(1, text.split("\n").length);
  const columns = Math.max(4, ...text.split("\n").map((line) => line.length + 1));
  return (
    <textarea
      ref={box}
      className="screenshot-overlay__text-input"
      style={{
        left: at.x,
        top: at.y,
        color,
        font: `600 ${size}px/${TEXT_LINE_HEIGHT} ${ANNOTATION_FONT}`,
        height: lines * size * TEXT_LINE_HEIGHT + 4,
        width: `calc(${columns}ch + 8px)`,
      }}
      value={text}
      placeholder={placeholder}
      rows={1}
      spellCheck={false}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => finish(true)}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") finish(false);
        else if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          finish(true);
        }
      }}
    />
  );
}
