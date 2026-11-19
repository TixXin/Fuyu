import type { Context } from "@fuyu/plugin-base";
import { PAGE_TITLE } from "./text.ts";
import { CollapsedBar } from "./ui/CollapsedBar.tsx";
import { MonitorPage } from "./ui/MonitorPage.tsx";
import "./styles.css";
import "./ui/programs.css";

const PAGE_ID = "@fuyu/system-monitor";

function MonitorIcon({ size = 16, strokeWidth = 2 }: { size?: number | string; strokeWidth?: number }) {
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export default function apply(ctx: Context) {
  function Page() {
    return <MonitorPage ctx={ctx} />;
  }

  function Collapsed() {
    return <CollapsedBar ctx={ctx} />;
  }

  ctx.slots.add("island.page/v1", {
    id: PAGE_ID,
    title: PAGE_TITLE,
    component: Page,
    icon: MonitorIcon,
  });

  ctx.slots.add("island.collapsed/v1", {
    id: PAGE_ID,
    component: Collapsed,
    hideable: true,
    opens: PAGE_ID,
  });
}
