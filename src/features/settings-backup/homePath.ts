const DEFAULT_FOLDER = "/.fuyu";

export function userHomeOf(defaultHome: string): string | null {
  return defaultHome.endsWith(DEFAULT_FOLDER) && defaultHome.length > DEFAULT_FOLDER.length
    ? defaultHome.slice(0, -DEFAULT_FOLDER.length)
    : null;
}

export function shortenHome(path: string, userHome: string | null): string {
  if (!userHome) return path;
  if (path === userHome) return "~";
  return path.startsWith(`${userHome}/`) ? `~${path.slice(userHome.length)}` : path;
}

export function expandHome(path: string, userHome: string | null): string {
  if (!userHome) return path;
  if (path === "~") return userHome;
  return path.startsWith("~/") ? `${userHome}${path.slice(1)}` : path;
}
