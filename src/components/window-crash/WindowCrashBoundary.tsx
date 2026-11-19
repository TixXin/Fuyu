import { Component, type ErrorInfo, type ReactNode } from "react";
import { WindowCrashFallback, type WindowCrashActions, type WindowCrashVariant } from "./WindowCrashFallback";

export type WindowCrashOutcome = { step: "reload" | "fallback"; retried: boolean };

type WindowCrashBoundaryProps = {
  variant: WindowCrashVariant | "silent";
  initial?: WindowCrashOutcome & { message: string };
  dev?: boolean;
  retryAfterMs?: number;
  onCrash: (error: unknown, componentStack: string | null) => WindowCrashOutcome;
  actions: WindowCrashActions;
  children: ReactNode;
};

type WindowCrashBoundaryState = { crashed: boolean; outcome: WindowCrashOutcome | null; message: string };

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message ? `${error.name}: ${error.message}` : error.name;
  return typeof error === "string" ? error : "";
}

export class WindowCrashBoundary extends Component<WindowCrashBoundaryProps, WindowCrashBoundaryState> {
  state: WindowCrashBoundaryState = {
    crashed: this.props.initial !== undefined,
    outcome: this.props.initial ?? null,
    message: this.props.initial?.message ?? "",
  };

  static getDerivedStateFromError(error: unknown): Partial<WindowCrashBoundaryState> {
    return { crashed: true, message: messageOf(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ outcome: this.props.onCrash(error, info.componentStack ?? null) });
  }

  render() {
    const { variant, dev, retryAfterMs, actions, children } = this.props;
    const { crashed, outcome, message } = this.state;
    if (!crashed) return children;
    if (outcome?.step !== "fallback" || variant === "silent") return null;
    return (
      <WindowCrashFallback variant={variant} retried={outcome.retried} dev={dev ?? false} message={message} retryAfterMs={retryAfterMs} actions={actions} />
    );
  }
}
