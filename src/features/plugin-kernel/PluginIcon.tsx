import { Component, type ReactNode } from "react";
import type { SlotIcon } from "./slots";
import "./PluginIcon.css";

type PluginIconProps = {
  icon: SlotIcon | undefined;
  label: string;
  size: number;
  strokeWidth: number;
  owner: string;
};

type BoundaryProps = { fallback: ReactNode; owner: string; children: ReactNode };

class IconBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[slot island.page/v1] the icon from ${this.props.owner} failed, showing a letter instead`, error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function PluginIcon({ icon: Icon, label, size, strokeWidth, owner }: PluginIconProps) {
  const letter = <span className="plugin-icon__letter" aria-hidden="true">{Array.from(label)[0]?.toUpperCase() ?? "?"}</span>;
  if (!Icon) return letter;
  return (
    <IconBoundary fallback={letter} owner={owner}>
      <Icon size={size} strokeWidth={strokeWidth} absoluteStrokeWidth aria-hidden="true" />
    </IconBoundary>
  );
}
