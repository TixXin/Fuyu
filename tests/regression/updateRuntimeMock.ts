import { emit } from "@tauri-apps/api/event";
import type { DownloadEvent, UpdateSnapshot } from "../../src/features/updater/api";
import { UPDATE_STATE_EVENT } from "../../src/features/updater/api";
import { DEMO_UPDATE, playDemoDownload } from "./updateDemo";

let snapshot: UpdateSnapshot = {
  revision: 0, stage: "idle", channel: null, nextVersion: "", notes: "", downloaded: 0, total: 0,
  detail: "", lastCheckedAt: null, lastAttemptAt: null, startedAt: Date.now(), checkFailures: 0,
};
async function update(patch: Partial<UpdateSnapshot>) {
  snapshot = { ...snapshot, ...patch, revision: snapshot.revision + 1 };
  await emit(UPDATE_STATE_EVENT, { ...snapshot });
}

export async function updateRuntimeMock(command: string, args: Record<string, unknown>, demo: boolean) {
  if (command === "updater_state") return { ...snapshot };
  if (command === "updater_notify") return true;
  if (command === "updater_metered") return false;
  if (command === "updater_download") {
    await update({ stage: "downloading", downloaded: 0, total: 0 });
    await update({ stage: "ready" });
    return null;
  }
  if (command === "updater_diagnostics") return { osVersion: "Windows build 26100.1", architecture: "x86_64" };
  if (command === "updater_check") {
    if (["checking", "downloading", "installing"].includes(snapshot.stage)) throw { code: "updater.busy", message: "busy" };
    await update({ stage: "checking", lastAttemptAt: Date.now() });
    await update({ stage: demo ? "available" : "latest", channel: args.channel === "beta" ? "beta" : "stable",
      nextVersion: demo ? DEMO_UPDATE.version : "", notes: demo ? DEMO_UPDATE.body ?? "" : "", lastCheckedAt: Date.now(), checkFailures: 0 });
    return demo ? DEMO_UPDATE : null;
  }
  if (command === "updater_install") {
    if (args.expectedVersion !== snapshot.nextVersion || args.expectedChannel !== snapshot.channel) throw { code: "updater.targetChanged", message: "target changed" };
    await update({ stage: "downloading", downloaded: 0, total: 0 });
    await playDemoDownload({ onmessage: (event: DownloadEvent) => {
      if (event.event === "Started") void update({ total: event.data.contentLength ?? 0 });
      if (event.event === "Progress") void update({ downloaded: snapshot.downloaded + event.data.chunkLength });
      if (event.event === "Finished") void update({ stage: "installing" });
    } });
    await update({ stage: "done" });
    return null;
  }
  throw new Error(`Unknown mock updater command ${command}`);
}
