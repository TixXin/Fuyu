import { useState, type ReactNode } from "react";
import { text } from "./text.ts";

export function copyText(value: string): Promise<boolean> {
  try {
    return navigator.clipboard.writeText(value).then(
      () => true,
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

export function Field({ label, value, onChange, placeholder, type = "text", suffix, wide, narrow }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: "text" | "date"; suffix?: ReactNode; wide?: boolean; narrow?: boolean }) {
  return (
    <label className={["fuyu-calc__field", wide ? "is-wide" : "", narrow ? "is-narrow" : ""].filter(Boolean).join(" ")}>
      <span className="fuyu-calc__label">{label}</span>
      <span className="fuyu-calc__control">
        <input
          className="fuyu-calc__input"
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={type === "text" ? "decimal" : undefined}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix}
      </span>
    </label>
  );
}

export function Select({ label, value, options, onChange }: { label?: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const select = (
    <select className="fuyu-calc__select" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
  if (!label) return select;
  return (
    <label className="fuyu-calc__field">
      <span className="fuyu-calc__label">{label}</span>
      {select}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="fuyu-calc__segmented" role="radiogroup">
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={option.value === value} className={option.value === value ? "is-on" : ""} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ResultRow({ label, value, copyValue, strong, sub }: { label: string; value: string; copyValue?: string; strong?: boolean; sub?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void copyText(copyValue ?? value).then(setCopied);
  };
  const className = ["fuyu-calc__row", strong ? "is-strong" : ""].filter(Boolean).join(" ");
  return (
    <button type="button" className={className} title={copied ? text.copied : text.copy} onClick={copy} onMouseLeave={() => setCopied(false)}>
      <span className="fuyu-calc__row-label">{label}</span>
      <span className="fuyu-calc__row-value">
        {value}
        {sub && <span className="fuyu-calc__row-sub">{sub}</span>}
      </span>
      {copied && <span className="fuyu-calc__row-copied">{text.copied}</span>}
    </button>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="fuyu-calc__note">{children}</p>;
}
