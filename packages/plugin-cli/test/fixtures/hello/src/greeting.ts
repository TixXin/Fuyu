export function greeting(who: string | undefined, pid: number): string {
  return `hello ${who ?? "there"}, from the plugin host (pid ${pid})`;
}
