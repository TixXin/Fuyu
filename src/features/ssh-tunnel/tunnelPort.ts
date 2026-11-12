export const MIN_REMOTE_PORT = 1024;

export function parseRemotePort(text: string): number | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const port = Number(trimmed);
  return port >= MIN_REMOTE_PORT && port <= 65535 ? port : "invalid";
}

export function exportLine(port: number) {
  const url = `http://127.0.0.1:${port}`;
  return `export http_proxy=${url} https_proxy=${url} HTTPS_PROXY=${url}`;
}
