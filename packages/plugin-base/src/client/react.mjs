import { Component, Suspense, createElement, useCallback, useSyncExternalStore } from "react";

export function useSlotItems(registry, name, group) {
  const subscribe = useCallback((notify) => registry.subscribe((changed) => changed === name && notify()), [registry, name]);
  const read = useCallback(() => registry.items(name, group), [registry, name, group]);
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
    const { slot, item, onError } = this.props;
    onError?.({ slot, id: item.id, owner: item.owner, external: item.external, error });
  }

  render() {
    if (this.state.error) return this.props.fallback ? this.props.fallback(this.state.error, this.props.item) : null;
    return this.props.children;
  }
}

export function SlotItems({ registry, name, group, props, select, wrap, fallback, onError }) {
  const items = useSlotItems(registry, name, group);
  return (select ? select(items) : items).map((item) => {
    const node = createElement(Suspense, { fallback: null }, createElement(item.component, props));
    return createElement(ItemBoundary, { key: `${item.owner}:${item.id}:${item.seq}`, slot: name, item, fallback, onError }, wrap ? wrap(item, node) : node);
  });
}

export function installShared(modules) {
  globalThis.__FUYU_SHARED__ = { ...globalThis.__FUYU_SHARED__, ...modules };
}
