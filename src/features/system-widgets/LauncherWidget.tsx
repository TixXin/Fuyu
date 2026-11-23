import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from "react";
import { Calculator, Check, Folder, Plus, Settings2, SquareTerminal, X } from "lucide-react";
import { clickOnly } from "../../components/island-widget/clickOnly";
import { useTranslation } from "../../i18n";
import type { IslandWidgetProps } from "../plugin-kernel/slots";
import { launchQuickApp, launchQuickAppPath, pickQuickApp, quickAppInfo } from "./api";
import { rememberAppInfo, useAppInfo } from "./appInfoCache";
import { hiddenBuiltins, launcherGrid, launcherKey, MAX_LAUNCHER_ITEMS, moveItem, withApp, type LauncherItem, type QuickTarget } from "./launcherItems.ts";
import { commitLauncher, currentLauncher, useLauncher } from "./launcherStore.ts";
import "./launcher.css";

const BUILTIN_ICONS = { terminal: SquareTerminal, files: Folder, calculator: Calculator, settings: Settings2 } as const;

type Tile = { kind: "item"; item: LauncherItem; index: number } | { kind: "ghost"; target: QuickTarget } | { kind: "add" } | { kind: "done" };

const logFailure = (what: string) => (failure: unknown) => console.error(what, failure);

function AppFace({ item, size }: { item: LauncherItem; size: number }) {
  const info = useAppInfo("path" in item ? item.path : null);
  if ("builtin" in item) {
    const Icon = BUILTIN_ICONS[item.builtin];
    return <Icon size={Math.round(size * 0.48)} strokeWidth={2} />;
  }
  if (info?.icon) return <img src={info.icon} alt="" draggable={false} />;
  return <span className="sys-launcher__letter">{(item.name || "?").slice(0, 1).toUpperCase()}</span>;
}

function useEditing(root: RefObject<HTMLDivElement | null>) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) return;
    const away = (event: globalThis.PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setEditing(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditing(false);
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", escape);
    };
  }, [editing, root]);
  return [editing, setEditing] as const;
}

function visibleTiles(tiles: Tile[], capacity: number): Tile[] {
  if (tiles.length <= capacity) return tiles;
  const controls = tiles.filter((tile) => tile.kind === "add" || tile.kind === "done");
  const rest = tiles.filter((tile) => tile.kind === "item" || tile.kind === "ghost");
  return [...rest.slice(0, Math.max(0, capacity - controls.length)), ...controls];
}

export function LauncherWidget({ width, height }: IslandWidgetProps) {
  const t = useTranslation().islandWidgets;
  const items = useLauncher();
  const root = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);
  const [editing, setEditing] = useEditing(root);
  const nameOf = (item: LauncherItem) => ("builtin" in item ? t.content.quickTargets[item.builtin] : item.name);
  const all: Tile[] = items.map((item, index) => ({ kind: "item", item, index }));
  if (editing) {
    all.push(...hiddenBuiltins(items).map((target): Tile => ({ kind: "ghost", target })));
    if (items.length < MAX_LAUNCHER_ITEMS) all.push({ kind: "add" });
    all.push({ kind: "done" });
  } else if (!items.length) {
    all.push({ kind: "add" });
  }
  const grid = launcherGrid(all.length, width, height);
  const tiles = visibleTiles(all, grid.capacity);
  const style = { "--launcher-tile": `${grid.tile}px`, gridTemplateColumns: `repeat(${grid.columns}, ${grid.tile}px)`, gap: grid.gap } as CSSProperties;

  const launch = (item: LauncherItem) => {
    const run = "builtin" in item ? launchQuickApp(item.builtin) : launchQuickAppPath(item.path);
    void run.catch(logFailure("Failed to open a quick launch item"));
  };
  const add = async () => {
    const path = await pickQuickApp(t.system.pickApp, t.system.appFilter);
    if (!path) return;
    const info = await quickAppInfo(path);
    rememberAppInfo(info);
    commitLauncher(withApp(currentLauncher(), info.path, info.name));
  };
  const startDrag = (index: number) => (event: PointerEvent<HTMLElement>) => {
    if (!editing || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragFrom.current = index;
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const from = dragFrom.current;
    if (from === null) return;
    const over = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-launch-index]");
    const to = over ? Number(over.dataset.launchIndex) : NaN;
    if (!Number.isInteger(to) || to === from) return;
    commitLauncher(moveItem(currentLauncher(), from, to));
    dragFrom.current = to;
  };
  const endDrag = () => {
    dragFrom.current = null;
  };

  return (
    <div
      ref={root}
      className="island-widget sys-launcher"
      style={style}
      data-editing={editing || undefined}
      title={editing ? t.system.editHint : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setEditing((current) => !current);
      }}
    >
      {tiles.map((tile) => {
        if (tile.kind === "add") {
          return (
            <button key="add" className="sys-launcher__app sys-launcher__tool" type="button" aria-label={t.system.addApp} title={t.system.addApp} onClick={clickOnly(() => void add().catch(logFailure("Failed to add a quick launch app")))}>
              <Plus size={Math.round(grid.tile * 0.45)} strokeWidth={2.2} />
            </button>
          );
        }
        if (tile.kind === "done") {
          return (
            <button key="done" className="sys-launcher__app sys-launcher__tool" type="button" data-tool="done" aria-label={t.system.doneEditing} title={t.system.doneEditing} onClick={clickOnly(() => setEditing(false))}>
              <Check size={Math.round(grid.tile * 0.45)} strokeWidth={2.4} />
            </button>
          );
        }
        if (tile.kind === "ghost") {
          const name = t.content.quickTargets[tile.target];
          return (
            <button key={`ghost:${tile.target}`} className="sys-launcher__app" type="button" data-target={tile.target} data-ghost="true" aria-label={t.system.restoreApp(name)} title={t.system.restoreApp(name)} onClick={clickOnly(() => commitLauncher([...currentLauncher(), { builtin: tile.target }]))}>
              <AppFace item={{ builtin: tile.target }} size={grid.tile} />
            </button>
          );
        }
        const { item, index } = tile;
        const name = nameOf(item);
        return (
          <div key={launcherKey(item)} className="sys-launcher__cell" data-launch-index={index} onPointerDown={startDrag(index)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <button
              className="sys-launcher__app"
              type="button"
              data-target={"builtin" in item ? item.builtin : "app"}
              aria-label={name}
              title={editing ? name : t.system.launcherHint(name)}
              onClick={clickOnly(() => {
                if (!editing) launch(item);
              })}
            >
              <AppFace item={item} size={grid.tile} />
            </button>
            {editing ? (
              <button className="sys-launcher__remove" type="button" aria-label={t.system.removeApp(name)} title={t.system.removeApp(name)} onPointerDown={(event) => event.stopPropagation()} onClick={clickOnly(() => commitLauncher(currentLauncher().filter((_, at) => at !== index)))}>
                <X size={10} strokeWidth={3} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
