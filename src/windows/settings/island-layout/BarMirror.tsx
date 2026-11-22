import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { MirrorBox, MirrorFrame } from "../../../features/plugin-kernel/barMirror";
import { useTranslation } from "../../../i18n";
import type { CollapsedPlacement } from "../../../lib/settings/collapsedItems";
import { paintMirror } from "./mirrorPaint";
import type { LaneDrag } from "./useLaneDrag";
import "./BarMirror.css";

const DROP_GAP = 4;

type Side = "left" | "right";
const place = (box: MirrorBox, within?: MirrorBox): CSSProperties =>
  ({ left: box.left - (within?.left ?? 0), top: box.top - (within?.top ?? 0), width: box.width, height: box.height });

export function BarMirror({ frame, names, placements, centers, openItem, drag, shelved, onPick, onDragStart }: {
  frame: MirrorFrame;
  names: ReadonlyMap<string, string>;
  placements: readonly CollapsedPlacement[];
  centers: readonly string[];
  openItem: string | null;
  drag: LaneDrag | null;
  shelved: string | null;
  onPick: (item: string) => void;
  onDragStart: (event: PointerEvent<HTMLElement>, item: string) => void;
}) {
  const text = useTranslation().settings.collapsedItems;
  const fit = useRef<HTMLDivElement>(null);
  const paint = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);

  useLayoutEffect(() => {
    const element = fit.current;
    if (!element) return;
    const measure = () => setRoom(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (paint.current) paintMirror(paint.current, frame.html);
  }, [frame.html]);

  const scale = room > 0 && frame.width > room ? room / frame.width : 1;
  const whole: MirrorBox = { left: 0, top: 0, width: frame.width, height: frame.height };
  const middle = frame.middle;
  const zones: Record<Side, MirrorBox> | null = middle && {
    left: { ...whole, width: Math.max(0, middle.left) },
    right: { ...whole, left: middle.left + middle.width, width: Math.max(0, frame.width - middle.left - middle.width) },
  };
  const sideOf = (box: MirrorBox): Side => (middle && box.left + box.width / 2 > middle.left + middle.width / 2 ? "right" : "left");
  const items = frame.items.filter((item) => names.has(item.id));
  const dropAt = () => {
    if (!drag || !zones || (drag.lane !== "left" && drag.lane !== "right")) return null;
    const lane = drag.lane;
    const order = placements.filter((placement) => placement.zone === lane && !placement.shelf && !placement.hidden).map(({ id }) => id);
    const shown = items.filter((item) => item.id !== drag.id && sideOf(item.box) === lane);
    const next = order.slice(order.indexOf(drag.id) + 1).map((id) => shown.find((item) => item.id === id)).find(Boolean);
    const end = shown.reduce((edge, item) => Math.max(edge, item.box.left + item.box.width), zones[lane].left + DROP_GAP);
    return next ? next.box.left - DROP_GAP : end + DROP_GAP;
  };
  const drop = dropAt();

  return (
    <div className="bar-mirror" ref={fit} data-form={frame.form}>
      <div className="bar-mirror__frame" style={{ width: frame.width * scale, height: frame.height * scale }}>
        <div className="bar-mirror__paint" ref={paint} style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }} aria-hidden="true" />
        <div className="bar-mirror__hits" data-lane-bar="" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
          {zones ? (["left", "right"] as const).map((lane) => (
            <div key={lane} className="bar-mirror__zone" data-lane={lane} data-over={drag?.lane === lane || undefined} style={place(zones[lane])}>
              {items.filter((item) => sideOf(item.box) === lane).map((item) => (
                <button
                  key={item.id}
                  className="bar-mirror__item"
                  type="button"
                  data-item={item.id}
                  data-dragging={drag?.id === item.id || undefined}
                  aria-pressed={openItem === item.id}
                  aria-label={names.get(item.id)}
                  title={names.get(item.id)}
                  style={place(item.box, zones[lane])}
                  onPointerDown={(event) => onDragStart(event, item.id)}
                  onClick={() => onPick(item.id)}
                />
              ))}
            </div>
          )) : null}
          {frame.center && centers.includes("center") ? (
            <div className="bar-mirror__zone" data-lane="center" style={place(frame.center)}>
              <button className="bar-mirror__item" type="button" data-item="center" aria-pressed={openItem === "center"} aria-label={text.item.center} title={text.item.center} style={place(frame.center, frame.center)} onClick={() => onPick("center")} />
            </div>
          ) : null}
          {frame.more && shelved ? (
            <button className="bar-mirror__item" type="button" data-lane="shelf" aria-label={text.place.panel} title={text.place.panel} style={place(frame.more)} onClick={() => onPick(shelved)} />
          ) : null}
          {frame.form === "notch" && middle ? <i className="bar-mirror__camera" style={{ left: middle.left + middle.width / 2, top: middle.top + middle.height / 2 }} /> : null}
          {drop !== null ? <i className="bar-mirror__drop" style={{ left: drop }} /> : null}
        </div>
      </div>
    </div>
  );
}
