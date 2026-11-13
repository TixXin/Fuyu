import { Fragment } from "react";
import { Keyboard } from "lucide-react";
import { shortcutKeyCaps } from "../../utils/shortcutKeys";
import "./ShortcutKeys.css";

export function ShortcutKeys({ label, prompt }: { label: string; prompt?: string | null }) {
  if (prompt) {
    return (
      <span className="shortcut-keys shortcut-keys--prompt">
        <Keyboard size={14} strokeWidth={2.2} aria-hidden="true" />
        <span>{prompt}</span>
      </span>
    );
  }
  const caps = shortcutKeyCaps(label);
  const separator = caps.join("") === label ? "" : label.includes(" + ") ? " + " : "+";
  return (
    <span className="shortcut-keys">
      {caps.map((cap, index) => (
        <Fragment key={index}>
          {index > 0 && separator ? <span className="shortcut-keys__plus">{separator}</span> : null}
          <kbd className="shortcut-keys__cap">{cap}</kbd>
        </Fragment>
      ))}
    </span>
  );
}
