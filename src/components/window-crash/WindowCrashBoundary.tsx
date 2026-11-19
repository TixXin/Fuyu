import { Component, type ErrorInfo, type ReactNode } from "react";
import { WindowCrashFallback, type WindowCrashVariant } from "./WindowCrashFallback";

export type WindowCrashStep = "reload" | "fallback";

type WindowCrashBoundaryProps = {
  variant: WindowCrashVariant | "silent";
  initialStep?: WindowCrashStep;
  retryAfterMs?: number;
  onCrash: (error: unknown, componentStack: string | null) => WindowCrashStep;
  onReload: () => void;
  onClose: () => void;
  children: ReactNode;
};

type WindowCrashBoundaryState = { crashed: boolean; step: WindowCrashStep | null };

export class WindowCrashBoundary extends Component<WindowCrashBoundaryProps, WindowCrashBoundaryState> {
  state: WindowCrashBoundaryState = { crashed: this.props.initialStep !== undefined, step: this.props.initialStep ?? null };

  static getDerivedStateFromError(): Partial<WindowCrashBoundaryState> {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ step: this.props.onCrash(error, info.componentStack ?? null) });
  }

  render() {
    const { variant, retryAfterMs, onReload, onClose, children } = this.props;
    if (!this.state.crashed) return children;
    if (this.state.step !== "fallback" || variant === "silent") return null;
    return <WindowCrashFallback variant={variant} retryAfterMs={retryAfterMs} onReload={onReload} onClose={onClose} />;
  }
}
