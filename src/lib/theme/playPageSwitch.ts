import { overlayLayers, pageLayers, type PageSwitchKind, type SwitchAxis, type SwitchDirection, type SwitchLayer, type SwitchPoint } from "./pageSwitch";

export type PageSwitchPlay = {
  stage: HTMLElement;
  targets: readonly HTMLElement[];
  effect: PageSwitchKind;
  direction: SwitchDirection;
  axis: SwitchAxis;
  origin: SwitchPoint | null;
  speed: number;
};

export type PageSwitchHandle = { finish: () => void };

const IDLE: PageSwitchHandle = { finish: () => {} };
const OVERLAY_STYLE: Record<"edge" | "sheen", Partial<CSSStyleDeclaration>> = {
  edge: {
    background: "var(--color-accent, rgb(116, 214, 255))",
    boxShadow: "0 0 14px 3px color-mix(in srgb, var(--color-accent, rgb(116, 214, 255)) 60%, transparent)",
    borderRadius: "2px",
  },
  sheen: {
    background: "linear-gradient(100deg, transparent, rgba(var(--overlay-rgb, 255, 255, 255), 0.1) 42%, rgba(var(--overlay-rgb, 255, 255, 255), 0.2) 50%, rgba(var(--overlay-rgb, 255, 255, 255), 0.1) 58%, transparent)",
  },
};

function animate(element: HTMLElement, layer: SwitchLayer, fill: FillMode): Animation | null {
  if (typeof element.animate !== "function") return null;
  return element.animate(layer.frames as Keyframe[], { duration: layer.duration, delay: layer.delay, easing: layer.easing, fill });
}

export function playPageSwitch({ stage, targets, effect, direction, axis, origin, speed }: PageSwitchPlay): PageSwitchHandle {
  if (effect === "none" || targets.length === 0) return IDLE;
  const stageBox = stage.getBoundingClientRect();
  const animations: Animation[] = [];
  const overlays: HTMLElement[] = [];
  for (const target of targets) {
    const box = target.getBoundingClientRect();
    const local = origin ? { x: origin.x - (box.left - stageBox.left), y: origin.y - (box.top - stageBox.top) } : null;
    for (const layer of pageLayers({ effect, direction, axis, origin: local, speed, box, random: Math.random })) {
      const animation = animate(target, layer, "backwards");
      if (animation) animations.push(animation);
    }
  }
  const visible = { width: stage.clientWidth, height: stage.clientHeight };
  for (const overlay of overlayLayers({ effect, direction, axis, origin, speed, box: visible, random: Math.random })) {
    const node = document.createElement("span");
    node.dataset.pageSwitchOverlay = overlay.kind;
    node.setAttribute("aria-hidden", "true");
    Object.assign(node.style, OVERLAY_STYLE[overlay.kind], overlay.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "5",
      marginTop: `${stage.scrollTop}px`,
      marginLeft: `${stage.scrollLeft}px`,
    });
    stage.append(node);
    overlays.push(node);
    const animation = animate(node, overlay.layer, "both");
    if (animation) {
      animations.push(animation);
      void animation.finished.then(() => node.remove(), () => node.remove());
    } else node.remove();
  }
  return {
    finish: () => {
      for (const animation of animations) {
        if (animation.playState !== "finished") animation.cancel();
      }
      for (const node of overlays) node.remove();
    },
  };
}
