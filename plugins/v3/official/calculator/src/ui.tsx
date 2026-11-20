import { useState, type ReactNode } from "react";
import { formatNumber, isPlainNumber, parseValue } from "./format.ts";
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

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date";
  suffix?: ReactNode;
  wide?: boolean;
  narrow?: boolean;
  math?: boolean;
}

export function Field({ label, value, onChange, placeholder, type = "text", suffix, wide, narrow, math = type === "text" }: FieldProps) {
  const computed = math && value.trim() && !isPlainNumber(value) ? parseValue(value) : null;
  const invalid = math && value.trim() !== "" && parseValue(value) === null;
  const className = ["fuyu-calc__field", wide ? "is-wide" : "", narrow ? "is-narrow" : ""].filter(Boolean).join(" ");
  return (
    <label className={className}>
      <span className="fuyu-calc__label">{label}</span>
      <span className={invalid ? "fuyu-calc__control is-invalid" : "fuyu-calc__control"}>
        <input
          className="fuyu-calc__input"
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={type === "text" && !math ? "decimal" : undefined}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {computed !== null && <span className="fuyu-calc__computed">= {formatNumber(computed, 8)}</span>}
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

interface ResultRowProps {
  label: string;
  value: string;
  copyValue?: string;
  strong?: boolean;
  sub?: string;
  onPick?: () => void;
}

export function ResultRow({ label, value, copyValue, strong, sub, onPick }: ResultRowProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void copyText(copyValue ?? value).then(setCopied);
  };
  const className = ["fuyu-calc__row", strong ? "is-strong" : "", onPick ? "has-pick" : ""].filter(Boolean).join(" ");
  return (
    <div className={className} onMouseLeave={() => setCopied(false)}>
      <button type="button" className="fuyu-calc__row-main" title={copied ? text.copied : text.copy} onClick={copy}>
        <span className="fuyu-calc__row-label">{label}</span>
        <span className="fuyu-calc__row-value">
          {value}
          {sub && <span className="fuyu-calc__row-sub">{sub}</span>}
        </span>
      </button>
      {copied && <span className="fuyu-calc__row-copied">{text.copied}</span>}
      {onPick && !copied && (
        <button type="button" className="fuyu-calc__row-pick" title={text.useAsBase} aria-label={`${text.useAsBase} · ${label}`} onClick={onPick}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m3 16 4 4 4-4" />
            <path d="M7 20V4" />
            <path d="m21 8-4-4-4 4" />
            <path d="M17 4v16" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="fuyu-calc__note">{children}</p>;
}

export function TodayButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="fuyu-calc__inline-button" onClick={onClick}>
      {text.date.today}
    </button>
  );
}
