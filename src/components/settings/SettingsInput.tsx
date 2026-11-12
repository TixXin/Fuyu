import { forwardRef, type InputHTMLAttributes } from "react";
import "./SettingsInput.css";

export const SettingsInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { monospace?: boolean }>(
  function SettingsInput({ monospace = false, className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={["settings-input", monospace ? "settings-input--mono" : "", className ?? ""].filter(Boolean).join(" ")}
        spellCheck={false}
        {...props}
      />
    );
  },
);
