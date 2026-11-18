export function entryOf(ctx) {
  let current = ctx?.fiber;
  while (current) {
    if (current.entry) return current.entry;
    const next = current.parent?.fiber;
    if (!next || next === current) return null;
    current = next;
  }
  return null;
}

export function ownerOf(fiber) {
  return entryOf({ fiber })?.options.id ?? null;
}

export function installInjectableAccessor(ctx, name, get) {
  const unprovide = ctx.provide(name, true);
  ctx.reflect.props[name] = { type: "accessor", get };
  const cleanup = ctx.effect(() => () => {
    delete ctx.reflect.props[name];
  }, `accessor(${name})`);
  return () => Promise.all([cleanup(), unprovide()]);
}
