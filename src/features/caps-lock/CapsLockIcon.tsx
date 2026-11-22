export function CapsLockIcon({ on, size = 16, className }: { on: boolean; size?: number; className?: string }) {
  const fill = on ? "currentColor" : "none";
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 17v-5H3.3L9 5.5l5.7 6.5h-3.2v5h-5z" fill={fill} />
      <rect x="14.3" y="15" width="7.4" height="6" rx="1.4" fill={fill} strokeWidth={1.6} />
      <path d={on ? "M15.9 15v-1.5a2.1 2.1 0 0 1 4.2 0V15" : "M15.9 15v-1.5a2.1 2.1 0 0 1 4.2 0"} strokeWidth={1.6} />
    </svg>
  );
}
