const KEYS: { label: string; insert?: string; action?: "clear" | "back" | "equals" | "negate"; kind?: "op" | "quiet" | "accent" }[] = [
  { label: "C", action: "clear", kind: "quiet" },
  { label: "(", insert: "(", kind: "quiet" },
  { label: ")", insert: ")", kind: "quiet" },
  { label: "%", insert: "%", kind: "quiet" },
  { label: "⌫", action: "back", kind: "quiet" },
  { label: "7", insert: "7" },
  { label: "8", insert: "8" },
  { label: "9", insert: "9" },
  { label: "÷", insert: "÷", kind: "op" },
  { label: "√", insert: "√(", kind: "quiet" },
  { label: "4", insert: "4" },
  { label: "5", insert: "5" },
  { label: "6", insert: "6" },
  { label: "×", insert: "×", kind: "op" },
  { label: "xʸ", insert: "^", kind: "quiet" },
  { label: "1", insert: "1" },
  { label: "2", insert: "2" },
  { label: "3", insert: "3" },
  { label: "−", insert: "-", kind: "op" },
  { label: "ans", insert: "ans", kind: "quiet" },
  { label: "0", insert: "0" },
  { label: ".", insert: "." },
  { label: "±", action: "negate", kind: "quiet" },
  { label: "+", insert: "+", kind: "op" },
  { label: "=", action: "equals", kind: "accent" },
];

export function Keypad({ onInsert, onAction }: { onInsert: (text: string) => void; onAction: (action: "clear" | "back" | "equals" | "negate") => void }) {
  return (
    <div className="fuyu-calc__keypad" role="group">
      {KEYS.map((key) => (
        <button
          key={key.label}
          type="button"
          tabIndex={-1}
          className={key.kind ? `fuyu-calc__pad is-${key.kind}` : "fuyu-calc__pad"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (key.action) onAction(key.action);
            else if (key.insert) onInsert(key.insert);
          }}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
