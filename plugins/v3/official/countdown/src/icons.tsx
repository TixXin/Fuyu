import type { ReactNode } from "react";

type IconProps = { size?: number | string; strokeWidth?: number };

function Svg({ size = 16, strokeWidth = 2, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}

export function GripIcon(props: IconProps) {
  return (
    <Svg size={14} {...props}>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </Svg>
  );
}

export function StarIcon({ filled, ...props }: IconProps & { filled: boolean }) {
  return (
    <svg width={props.size ?? 15} height={props.size ?? 15} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Svg size={14} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Svg size={14} {...props}>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg size={14} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Svg size={13} {...props}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}
