export const WATCH_IGNORED_DIRS: readonly string[];
export const WATCH_IGNORED_GLOBS: readonly string[];
export function createWatchIgnored(root?: string): (filePath: string) => boolean;
export function isWatchIgnored(filePath: string, root?: string): boolean;
