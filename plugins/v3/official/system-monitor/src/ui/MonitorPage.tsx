import type { Context } from "@fuyu/plugin-base";
import { useRef } from "react";
import type { Layout } from "../protocol.ts";
import { TEXT } from "../text.ts";
import { useSystemMonitor } from "../useSystemMonitor.ts";
import { ExtraLine, MemoryLine, NetworkLine, networkShown } from "./Lines.tsx";
import { Programs, programsShown } from "./Programs.tsx";
import { CpuUnit, GpuUnit, gpuShownFor } from "./Units.tsx";
import { useElementSize } from "./useElementSize.ts";
import { useHistory } from "./useHistory.ts";

export const SINGLE_COLUMN_BELOW = 600;

export function columnsFor(layout: Layout, width: number): "single" | "double" {
  if (layout === "single" || layout === "double") return layout;
  return width > 0 && width < SINGLE_COLUMN_BELOW ? "single" : "double";
}

export function MonitorPage({ ctx }: { ctx: Context }) {
  const { state, locale, error } = useSystemMonitor(ctx, true);
  const copy = TEXT[locale];
  const rootRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(rootRef);
  const { sample, features, platform, config } = state;
  const history = useHistory(ctx, sample);
  const columns = columnsFor(config.layout, width);

  if (!sample) {
    return (
      <div ref={rootRef} className="fuyu-sysmon fuyu-sysmon--waiting">
        <p className="fuyu-sysmon__waiting">{error ?? copy.reading}</p>
      </div>
    );
  }

  const showGpu = features.gpu && gpuShownFor(sample.gpu);
  const showPrograms = features.programs && programsShown(sample);
  const className = [
    "fuyu-sysmon",
    `fuyu-sysmon--${columns}`,
    showPrograms ? "" : "fuyu-sysmon--no-programs",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={className}>
      <div className="fuyu-sysmon__stats">
        <div className={`fuyu-sysmon__pair${showGpu ? "" : " fuyu-sysmon__pair--solo"}`}>
          <CpuUnit sample={sample} history={history.cpu} locale={locale} />
          {showGpu && <GpuUnit reading={sample.gpu} history={history.gpu} locale={locale} />}
        </div>
        <MemoryLine sample={sample} locale={locale} />
        {features.network && networkShown(sample) && (
          <NetworkLine sample={sample} down={history.down} up={history.up} locale={locale} />
        )}
        <ExtraLine sample={sample} locale={locale} />
      </div>
      {showPrograms && (
        <Programs
          ctx={ctx}
          sample={sample}
          features={features}
          platform={platform}
          locale={locale}
          columns={columns === "single" ? 2 : 1}
        />
      )}
    </div>
  );
}
