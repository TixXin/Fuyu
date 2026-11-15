export function ownerOf(fiber) {
  let current = fiber;
  while (current) {
    if (current.entry) return current.entry.options.id;
    const next = current.parent?.fiber;
    if (!next || next === current) return null;
    current = next;
  }
  return null;
}
