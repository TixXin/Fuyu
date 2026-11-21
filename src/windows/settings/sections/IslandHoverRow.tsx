import { useEffect, useRef, type PointerEvent } from "react";
import { useTranslation } from "../../../i18n";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useReducedMotion } from "../../../lib/theme/useReducedMotion";
import { advanceHoverSpring, hoverNearness, hoverSettled, islandHoverShape, type HoverSpring } from "../../../lib/theme/islandHover";
import type { IslandHover } from "../../../lib/settings/types";
import "./IslandMotionRow.css";
import "./IslandHoverRow.css";

export function IslandHoverRow({ value, onChange }: { value: IslandHover; onChange: (value: IslandHover) => void }) {
  const text = useTranslation().settings.expand;
  const reducedMotion = useReducedMotion();
  const islandRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const spring = useRef<HoverSpring>({ value: 0, velocity: 0 });
  const shape = reducedMotion ? null : islandHoverShape(value);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    const island = islandRef.current;
    if (!island) return;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    spring.current = { value: 0, velocity: 0 };
    island.style.setProperty("--hover-grow-x", "0px");
    island.style.setProperty("--hover-grow-y", "0px");
  }, [shape]);

  const target = () => {
    const island = islandRef.current;
    if (!shape || !island || !pointer.current) return 0;
    const rect = island.getBoundingClientRect();
    const grownX = shape.growX * spring.current.value;
    const dx = Math.max(0, Math.abs(pointer.current.x - (rect.left + rect.width / 2)) - (rect.width - grownX) / 2);
    const dy = Math.max(0, pointer.current.y - (rect.bottom - shape.growY * spring.current.value));
    return hoverNearness(Math.hypot(dx, dy), shape.range);
  };

  const wake = () => {
    if (frame.current || !shape) return;
    let last = 0;
    const step = (now: number) => {
      const island = islandRef.current;
      if (!island) return;
      const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const goal = target();
      advanceHoverSpring(spring.current, goal, seconds, shape.response, shape.damping);
      if (hoverSettled(spring.current, goal)) spring.current = { value: goal, velocity: 0 };
      island.style.setProperty("--hover-grow-x", `${(shape.growX * spring.current.value).toFixed(2)}px`);
      island.style.setProperty("--hover-grow-y", `${(shape.growY * spring.current.value).toFixed(2)}px`);
      frame.current = spring.current.velocity === 0 && spring.current.value === goal ? 0 : requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    pointer.current = { x: event.clientX, y: event.clientY };
    wake();
  };
  const onLeave = () => {
    pointer.current = null;
    wake();
  };

  const options = [
    { value: "bounce", label: text.hoverBounce },
    { value: "near", label: text.hoverNear },
    { value: "subtle", label: text.hoverSubtle },
    { value: "bold", label: text.hoverBold },
    { value: "drop", label: text.hoverDrop },
    { value: "touch", label: text.hoverTouch },
    { value: "none", label: text.hoverNone },
  ] as const;

  return (
    <SettingsRow
      title={text.hoverEffect}
      description={text.hoverMotionHint}
      control={<SettingsSelect<IslandHover> value={value} options={options} ariaLabel={text.hoverEffect} onChange={onChange} />}
    >
      <div className="island-motion-preview island-hover-preview" onPointerMove={onMove} onPointerLeave={onLeave}>
        <div ref={islandRef} className="island-motion-preview__island island-hover-preview__island" />
        <span className="island-hover-preview__hint">{text.hoverTry}</span>
      </div>
    </SettingsRow>
  );
}
