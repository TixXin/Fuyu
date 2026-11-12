import { useEffect, useRef, useState } from "react";
import { ANNOTATION_FONT, TEXT_LINE_HEIGHT } from "../../features/screenshot/drawAnnotations";
import type { Point } from "../../features/screenshot/selection";

export function AnnotationTextInput({
  at,
  color,
  size,
  placeholder,
  onCommit,
  onCancel,
}: {
  at: Point;
  color: string;
  size: number;
  placeholder: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
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
