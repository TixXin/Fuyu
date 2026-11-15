import { Component, Suspense, createElement, useCallback, useSyncExternalStore } from "react";

export function useSlotItems(registry, name) {
  const subscribe = useCallback((notify) => registry.subscribe((changed) => changed === name && notify()), [registry, name]);
  const read = useCallback(() => registry.items(name), [registry, name]);
  return useSyncExternalStore(subscribe, read, read);
}

class ItemBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    this.props.onError?.(this.props.item, error);
  }

  render() {
    if (this.state.error) return this.props.fallback ? this.props.fallback(this.state.error, this.props.item) : null;
    return this.props.children;
  }
}

export function SlotItems({ registry, name, props, fallback, onError }) {
  const items = useSlotItems(registry, name);
  return items.map((item) =>
    createElement(
      ItemBoundary,
      { key: `${item.owner}:${item.id}:${item.seq}`, item, fallback, onError },
      createElement(Suspense, { fallback: null }, createElement(item.component, props)),
    ),
  );
}

export function installShared(modules) {
  globalThis.__FUYU_SHARED__ = { ...globalThis.__FUYU_SHARED__, ...modules };
}
