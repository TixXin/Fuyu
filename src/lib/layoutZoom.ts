export function layoutZoom(element: HTMLElement, rect: DOMRect = element.getBoundingClientRect()): number {
  if (element.offsetWidth > 0 && rect.width > 0) return rect.width / element.offsetWidth;
  if (element.offsetHeight > 0 && rect.height > 0) return rect.height / element.offsetHeight;
  return 1;
}
