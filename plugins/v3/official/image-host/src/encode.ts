export function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function encodeKey(key: string): string {
  return key.split("/").map(encodeSegment).join("/");
}
